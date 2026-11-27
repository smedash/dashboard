import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadProjectTopicGaps } from "@/lib/keyword-map/project-topic-gaps";
import { requireUser } from "@/lib/keyword-map/server";
import { scoreTopicRelevance } from "@/lib/keyword-map/topic-relevance";

export const maxDuration = 300;

/** Drei parallele Claude-Batches à 60 Topics pro Anfrage */
const TOPICS_PER_REQUEST = 180;

async function findProject(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return prisma.keywordMapProject.findUnique({ where: { id }, select: { id: true, countryCode: true, languageCode: true } });
}

/** Bewertet die Kernnähe offener Topic-Gaps ohne aktuelle Bewertung. */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const project = await findProject(ctx);
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY fehlt" }, { status: 503 });
    }

    const { gaps } = await loadProjectTopicGaps(project);
    const pending = gaps.filter((g) => g.relevance === null);
    const batch = pending.slice(0, TOPICS_PER_REQUEST).map((g) => ({ key: g.key, topic: g.topic, path: g.occurrences[0]?.path ?? [] }));
    const result = await scoreTopicRelevance(project.id, batch);
    return NextResponse.json({ ...result, remaining: Math.max(0, pending.length - result.fetched) });
  } catch (e) {
    console.error("[keyword-mapping/projects/[id]/topic-relevance] POST", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kernnähe konnte nicht bewertet werden" }, { status: 500 });
  }
}

/** Verwirft alle Bewertungen des Projekts, damit sie neu berechnet werden. */
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const project = await findProject(ctx);
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    const { count } = await prisma.keywordMapTopicRelevance.deleteMany({ where: { projectId: project.id } });
    return NextResponse.json({ deleted: count });
  } catch (e) {
    console.error("[keyword-mapping/projects/[id]/topic-relevance] DELETE", e);
    return NextResponse.json({ error: "Bewertungen konnten nicht zurückgesetzt werden" }, { status: 500 });
  }
}
