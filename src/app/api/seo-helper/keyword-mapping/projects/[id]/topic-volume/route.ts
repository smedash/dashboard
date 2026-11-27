import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchMissingKeywordVolumes, volumeLocale } from "@/lib/keyword-map/keyword-volume";
import { loadProjectTopicGaps } from "@/lib/keyword-map/project-topic-gaps";
import { requireUser } from "@/lib/keyword-map/server";

export const maxDuration = 300;

/** Pro Anfrage 5 DataForSEO-Requests à 100 Keywords (mit Pausen ca. 30–60 s) */
const TOPICS_PER_REQUEST = 500;

/** Fragt das Google-Ads-Suchvolumen der offenen Topic-Gaps ohne Cache-Eintrag bei DataForSEO ab. */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const project = await prisma.keywordMapProject.findUnique({ where: { id }, select: { id: true, countryCode: true, languageCode: true } });
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    const locale = volumeLocale(project.countryCode, project.languageCode);
    if (!locale) {
      return NextResponse.json({ error: `Land/Sprache „${project.countryCode}/${project.languageCode}“ wird nicht unterstützt` }, { status: 400 });
    }
    if (!process.env.DATAFORSEO_USERNAME?.trim() || !process.env.DATAFORSEO_PASSWORD?.trim()) {
      return NextResponse.json({ error: "DataForSEO API-Zugangsdaten fehlen" }, { status: 503 });
    }

    const { gaps } = await loadProjectTopicGaps(project);
    const keywords = gaps.filter((g) => g.topicSv === null).map((g) => g.key);
    return NextResponse.json(await fetchMissingKeywordVolumes(keywords, locale, TOPICS_PER_REQUEST));
  } catch (e) {
    console.error("[keyword-mapping/projects/[id]/topic-volume] POST", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Suchvolumen konnten nicht geladen werden" }, { status: 500 });
  }
}
