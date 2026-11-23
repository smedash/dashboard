import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/keyword-map/server";
import { runCrossCoverage } from "@/lib/keyword-map/cross-coverage";

export const maxDuration = 300;

/** Gleicht eine bestehende Gap-Analyse (erneut) mit den anderen URLs aus dem Content-Mapping ab (Body: `{ gapId }`). */
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

    await runCrossCoverage(gap.id);
    const updated = await prisma.keywordMapTopicGap.findUnique({ where: { id: gap.id }, select: { results: true, crossCoverageError: true } });
    return NextResponse.json({ results: updated?.results ?? [], crossCoverageError: updated?.crossCoverageError ?? null });
  } catch (e) {
    console.error("[keyword-mapping/topic-gap/cross-coverage] POST", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Abgleich fehlgeschlagen" }, { status: 500 });
  }
}
