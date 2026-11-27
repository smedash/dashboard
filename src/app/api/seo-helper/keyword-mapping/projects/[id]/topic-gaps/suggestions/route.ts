import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/keyword-map/server";
import { TopicSuggestionError, suggestTopicArticles } from "@/lib/keyword-map/topic-suggestions";

export const maxDuration = 120;

/** KI-Artikelvorschläge für ein offenes Topic (Body: `{ occurrences: [{ gapId, index }] }`) */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { occurrences?: unknown };
    const occurrences = Array.isArray(body.occurrences)
      ? body.occurrences.filter(
          (o): o is { gapId: string; index: number } =>
            typeof o?.gapId === "string" && Number.isInteger(o?.index) && o.index >= 0
        )
      : [];
    if (occurrences.length === 0) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

    return NextResponse.json(await suggestTopicArticles(id, occurrences));
  } catch (e) {
    if (e instanceof TopicSuggestionError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[keyword-mapping/projects/[id]/topic-gaps/suggestions] POST", e);
    return NextResponse.json({ error: "Artikelvorschläge konnten nicht erstellt werden" }, { status: 500 });
  }
}
