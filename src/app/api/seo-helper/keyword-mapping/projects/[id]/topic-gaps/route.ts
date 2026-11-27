import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadProjectTopicGaps } from "@/lib/keyword-map/project-topic-gaps";
import { requireUser } from "@/lib/keyword-map/server";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const project = await prisma.keywordMapProject.findUnique({ where: { id }, select: { id: true, countryCode: true, languageCode: true } });
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    return NextResponse.json(await loadProjectTopicGaps(project));
  } catch (e) {
    console.error("[keyword-mapping/projects/[id]/topic-gaps] GET", e);
    return NextResponse.json({ error: "Topic-Gaps konnten nicht geladen werden" }, { status: 500 });
  }
}
