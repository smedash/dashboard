import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/keyword-map/server";
import { runLinkCheck } from "@/lib/keyword-map/internal-links";

export const maxDuration = 120;

/** Prüft (erneut), ob die URL bereits intern auf die anderswo abdeckenden URLs verlinkt (Body: `{ gapId }`). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { gapId?: unknown };
    if (typeof body.gapId !== "string") return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

    const gap = await prisma.keywordMapTopicGap.findFirst({ where: { id: body.gapId, urlId: id }, select: { id: true, status: true } });
    if (!gap) return NextResponse.json({ error: "Analyse nicht gefunden" }, { status: 404 });
    if (gap.status !== "succeeded") return NextResponse.json({ error: "Analyse ist noch nicht abgeschlossen" }, { status: 409 });

    await runLinkCheck(gap.id);
    const updated = await prisma.keywordMapTopicGap.findUnique({
      where: { id: gap.id },
      select: { results: true, linksCheckedAt: true, linkCheckError: true },
    });
    return NextResponse.json({
      results: updated?.results ?? [],
      linksCheckedAt: updated?.linksCheckedAt?.toISOString() ?? null,
      linkCheckError: updated?.linkCheckError ?? null,
    });
  } catch (e) {
    console.error("[keyword-mapping/topic-gap/links] POST", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Linkprüfung fehlgeschlagen" }, { status: 500 });
  }
}
