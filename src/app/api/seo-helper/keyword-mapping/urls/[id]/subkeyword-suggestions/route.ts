import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKeywordSuggestions, SeosparkError } from "@/lib/seospark";
import { requireUser } from "@/lib/keyword-map/server";
import { normalizeKeyword, type SubkeywordSuggestion } from "@/lib/keyword-map/shared";

/** SEOSpark-Vorschläge zum Fokus-Keyword (oder `keyword` im Body) der URL. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { keyword?: string };

    const row = await prisma.keywordMapUrl.findUnique({
      where: { id },
      include: { keywords: true, project: true },
    });
    if (!row) return NextResponse.json({ error: "URL nicht gefunden" }, { status: 404 });

    const seed = body.keyword?.trim() || row.keywords.find((k) => k.type === "focus")?.keyword;
    if (!seed) {
      return NextResponse.json({ error: "Kein Fokus-Keyword gesetzt" }, { status: 400 });
    }

    const result = await getKeywordSuggestions(seed, {
      countryCode: row.project.countryCode,
      languageCode: row.project.languageCode,
      category: row.project.category,
    });

    const keywords = result.suggestions.map((s) => normalizeKeyword(s.keyword));
    const elsewhere = await prisma.keywordMapKeyword.findMany({
      where: { keyword: { in: keywords }, url: { projectId: row.projectId, id: { not: id } } },
      select: { keyword: true, type: true, url: { select: { id: true, url: true } } },
    });
    const elsewhereByKeyword = new Map<string, SubkeywordSuggestion["assignedElsewhere"]>();
    for (const e of elsewhere) {
      const list = elsewhereByKeyword.get(e.keyword) ?? [];
      list.push({ urlId: e.url.id, url: e.url.url, type: e.type });
      elsewhereByKeyword.set(e.keyword, list);
    }
    const hereByKeyword = new Map(row.keywords.map((k) => [k.keyword, k.type as "focus" | "sub"]));

    const byKeyword = new Map<string, SubkeywordSuggestion>();
    for (const s of result.suggestions) {
      const kw = normalizeKeyword(s.keyword);
      const prev = byKeyword.get(kw);
      if (!kw || (prev && (prev.searchVolume ?? 0) >= (s.searchVolume ?? 0))) continue;
      byKeyword.set(kw, {
        keyword: kw,
        searchVolume: s.searchVolume,
        difficulty: s.difficulty,
        cpc: s.cpc,
        searchIntents: s.searchIntents,
        assignedHere: hereByKeyword.get(kw) ?? null,
        assignedElsewhere: elsewhereByKeyword.get(kw) ?? [],
      });
    }
    const suggestions = [...byKeyword.values()];

    return NextResponse.json({
      seed: result.keyword,
      totalCount: result.totalCount,
      cached: result.cached,
      createdAt: result.createdAt,
      suggestions,
    });
  } catch (e) {
    if (e instanceof SeosparkError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[keyword-mapping/subkeyword-suggestions]", e);
    return NextResponse.json({ error: "Vorschläge konnten nicht geladen werden" }, { status: 500 });
  }
}
