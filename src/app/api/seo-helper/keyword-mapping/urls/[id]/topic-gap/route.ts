import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/keyword-map/server";
import { advanceTopicGap, ensureTopicGraph } from "@/lib/keyword-map/topic-gap";

export const maxDuration = 300;

async function gapResponse(gapId: string) {
  const gap = await prisma.keywordMapTopicGap.findUnique({ where: { id: gapId } });
  if (!gap) return { gap: null, topicGraph: null };
  const graph = gap.topicGraphId
    ? await prisma.topicGraph.findUnique({ where: { id: gap.topicGraphId }, select: { status: true, topicGraph: true, totalTopics: true } })
    : null;
  return {
    gap: {
      id: gap.id,
      focusKeyword: gap.focusKeyword,
      status: gap.status,
      coverageScore: gap.coverageScore,
      results: gap.results ?? [],
      summary: gap.summary,
      error: gap.error,
      createdAt: gap.createdAt.toISOString(),
      updatedAt: gap.updatedAt.toISOString(),
    },
    topicGraph: graph
      ? { status: graph.status, totalTopics: graph.totalTopics, tree: graph.topicGraph ? JSON.parse(graph.topicGraph) : null }
      : null,
  };
}

/** Neue Gap-Analyse starten (Body: `{ keyword?, refreshTopics? }`, Standard: Fokus-Keyword). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { keyword?: string; refreshTopics?: boolean };
    const row = await prisma.keywordMapUrl.findUnique({ where: { id }, include: { keywords: true, project: true } });
    if (!row) return NextResponse.json({ error: "URL nicht gefunden" }, { status: 404 });

    const keyword = body.keyword?.trim().toLowerCase() || row.keywords.find((k) => k.type === "focus")?.keyword;
    if (!keyword) return NextResponse.json({ error: "Kein Fokus-Keyword gesetzt" }, { status: 400 });

    const graph = await ensureTopicGraph({
      keyword,
      countryCode: row.project.countryCode,
      languageCode: row.project.languageCode,
      userId: user.id,
      category: row.project.category,
      force: body.refreshTopics === true,
    });
    const gap = await prisma.keywordMapTopicGap.create({
      data: { urlId: id, focusKeyword: keyword, topicGraphId: graph.id, status: "processing" },
    });

    // Bei gecachtem Topic-Graph läuft die Analyse direkt in diesem Request
    if (graph.status === "succeeded") await advanceTopicGap(gap.id);
    return NextResponse.json(await gapResponse(gap.id));
  } catch (e) {
    console.error("[keyword-mapping/topic-gap] POST", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Analyse konnte nicht gestartet werden" }, { status: 500 });
  }
}

/** Neueste (oder per `?gapId=` gewählte) Analyse abrufen und dabei weiterführen, solange sie läuft. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const gapId = request.nextUrl.searchParams.get("gapId");
    const gap = gapId
      ? await prisma.keywordMapTopicGap.findFirst({ where: { id: gapId, urlId: id } })
      : await prisma.keywordMapTopicGap.findFirst({ where: { urlId: id }, orderBy: { createdAt: "desc" } });
    if (!gap) return NextResponse.json({ gap: null, topicGraph: null });

    if (gap.status === "processing" || gap.status === "analyzing") await advanceTopicGap(gap.id);
    return NextResponse.json(await gapResponse(gap.id));
  } catch (e) {
    console.error("[keyword-mapping/topic-gap] GET", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Analyse konnte nicht geladen werden" }, { status: 500 });
  }
}
