import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { researchKeyword } from "@/lib/keyword-map/keyword-research";
import { requireUser } from "@/lib/keyword-map/server";

export const maxDuration = 120;

const MAX_BATCH = 3;

/**
 * Holt fehlende SEOSpark-Recherchen für Fokus-Keywords aus den Gap-Analysen des Projekts
 * (Body: `{ keywords }`, max. 3 pro Anfrage, nacheinander wegen API-Limits).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { keywords?: unknown };
    const requested = Array.isArray(body.keywords)
      ? [...new Set(body.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim().toLowerCase()).filter(Boolean))]
      : [];
    if (requested.length === 0) return NextResponse.json({ results: {} });
    if (requested.length > MAX_BATCH) {
      return NextResponse.json({ error: `Maximal ${MAX_BATCH} Keywords pro Anfrage` }, { status: 400 });
    }

    const project = await prisma.keywordMapProject.findUnique({
      where: { id },
      select: { countryCode: true, languageCode: true, category: true },
    });
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });

    const known = await prisma.keywordMapTopicGap.findMany({
      where: { url: { projectId: id }, status: "succeeded" },
      select: { focusKeyword: true },
      distinct: ["focusKeyword"],
    });
    const allowed = new Set(known.map((g) => g.focusKeyword.trim().toLowerCase()));

    const results: Record<string, { status: "ok" | "error"; error?: string }> = {};
    for (const keyword of requested) {
      if (!allowed.has(keyword)) {
        results[keyword] = { status: "error", error: "Kein Fokus-Keyword einer Gap-Analyse dieses Projekts" };
        continue;
      }
      try {
        await researchKeyword(keyword, project);
        results[keyword] = { status: "ok" };
      } catch (e) {
        results[keyword] = { status: "error", error: e instanceof Error ? e.message : "Recherche fehlgeschlagen" };
      }
    }
    return NextResponse.json({ results });
  } catch (e) {
    console.error("[keyword-mapping/projects/[id]/keyword-research] POST", e);
    return NextResponse.json({ error: "Keyword-Recherche fehlgeschlagen" }, { status: 500 });
  }
}
