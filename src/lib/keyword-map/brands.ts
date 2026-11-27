import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type TopicGapItem, cleanBrandList, computeCoverageScore, createBrandMatcher, isBrandTopic } from "./shared";

export async function getExcludedBrands(): Promise<string[]> {
  const row = await prisma.keywordMapSettings.findUnique({ where: { id: "default" }, select: { excludedBrands: true } });
  return row?.excludedBrands ?? [];
}

export async function getBrandMatcher(): Promise<(text: string) => boolean> {
  return createBrandMatcher(await getExcludedBrands());
}

/**
 * Wendet die Ausschlussliste auf alle erfolgreichen Gap-Analysen an: Marken-Topics wandern aus `results`
 * nach `excludedResults`, nicht mehr betroffene Topics zurück. Die Coverage wird neu berechnet.
 */
export async function applyBrandExclusion(brands: string[]): Promise<{ excluded: number; restored: number }> {
  const matches = createBrandMatcher(brands);
  const needsChange = (results: unknown, hidden: unknown) =>
    (Array.isArray(results) && (results as TopicGapItem[]).some((i) => isBrandTopic(i, matches))) ||
    (Array.isArray(hidden) && (hidden as TopicGapItem[]).some((i) => !isBrandTopic(i, matches)));
  const gaps = await prisma.keywordMapTopicGap.findMany({
    where: { status: "succeeded" },
    select: { id: true, results: true, excludedResults: true },
  });
  let excluded = 0;
  let restored = 0;

  for (const { id } of gaps.filter((g) => needsChange(g.results, g.excludedResults))) {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ results: unknown; excludedResults: unknown }>>`
        SELECT "results", "excludedResults" FROM "KeywordMapTopicGap" WHERE "id" = ${id} FOR UPDATE
      `;
      const results = Array.isArray(rows[0]?.results) ? (rows[0].results as TopicGapItem[]) : [];
      const hidden = Array.isArray(rows[0]?.excludedResults) ? (rows[0].excludedResults as TopicGapItem[]) : [];
      const toHide = results.filter((i) => isBrandTopic(i, matches));
      const toRestore = hidden.filter((i) => !isBrandTopic(i, matches));
      if (toHide.length === 0 && toRestore.length === 0) return;

      const nextResults = [...results.filter((i) => !isBrandTopic(i, matches)), ...toRestore];
      const nextHidden = [...hidden.filter((i) => isBrandTopic(i, matches)), ...toHide];
      await tx.keywordMapTopicGap.update({
        where: { id },
        data: {
          results: nextResults as unknown as Prisma.InputJsonValue,
          excludedResults: nextHidden.length ? (nextHidden as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          coverageScore: computeCoverageScore(nextResults),
        },
      });
      excluded += toHide.length;
      restored += toRestore.length;
    });
  }
  return { excluded, restored };
}

export async function saveExcludedBrands(values: string[]) {
  const brands = cleanBrandList(values);
  await prisma.keywordMapSettings.upsert({
    where: { id: "default" },
    update: { excludedBrands: brands },
    create: { id: "default", excludedBrands: brands },
  });
  return { brands, ...(await applyBrandExclusion(brands)) };
}
