import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type TopicGapItem, cleanBrandList, computeCoverageScore, createBrandMatcher, isBrandTopic, topicKey } from "./shared";

export async function getExcludedBrands(): Promise<string[]> {
  const row = await prisma.keywordMapSettings.findUnique({ where: { id: "default" }, select: { excludedBrands: true } });
  return row?.excludedBrands ?? [];
}

export async function getBrandMatcher(): Promise<(text: string) => boolean> {
  return createBrandMatcher(await getExcludedBrands());
}

/** Gesperrte Topic-Keys (`topicKey`) eines Projekts */
export async function getBlockedTopicKeys(projectId: string): Promise<Set<string>> {
  const rows = await prisma.keywordMapTopicBlock.findMany({ where: { projectId }, select: { key: true } });
  return new Set(rows.map((r) => r.key));
}

/**
 * Wendet Marken-Ausschluss und Topic-Sperrliste auf die erfolgreichen Gap-Analysen an: betroffene Topics
 * wandern aus `results` nach `excludedResults`, nicht mehr betroffene zurück. Die Coverage wird neu berechnet.
 * Ohne `projectId` werden alle Projekte bearbeitet.
 */
export async function applyTopicExclusion(options: { brands?: string[]; projectId?: string } = {}): Promise<{ excluded: number; restored: number }> {
  const matches = createBrandMatcher(options.brands ?? (await getExcludedBrands()));
  const blocks = await prisma.keywordMapTopicBlock.findMany({
    where: options.projectId ? { projectId: options.projectId } : {},
    select: { projectId: true, key: true },
  });
  const blockedByProject = new Map<string, Set<string>>();
  for (const b of blocks) {
    if (!blockedByProject.has(b.projectId)) blockedByProject.set(b.projectId, new Set());
    blockedByProject.get(b.projectId)!.add(b.key);
  }

  const gaps = await prisma.keywordMapTopicGap.findMany({
    where: { status: "succeeded", ...(options.projectId ? { url: { projectId: options.projectId } } : {}) },
    select: { id: true, results: true, excludedResults: true, url: { select: { projectId: true } } },
  });
  let excluded = 0;
  let restored = 0;

  for (const g of gaps) {
    const blocked = blockedByProject.get(g.url.projectId);
    const isExcluded = (i: TopicGapItem) => isBrandTopic(i, matches) || !!blocked?.has(topicKey(i.topic ?? ""));
    const needsChange =
      (Array.isArray(g.results) && (g.results as unknown as TopicGapItem[]).some(isExcluded)) ||
      (Array.isArray(g.excludedResults) && (g.excludedResults as unknown as TopicGapItem[]).some((i) => !isExcluded(i)));
    if (!needsChange) continue;

    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ results: unknown; excludedResults: unknown }>>`
        SELECT "results", "excludedResults" FROM "KeywordMapTopicGap" WHERE "id" = ${g.id} FOR UPDATE
      `;
      const results = Array.isArray(rows[0]?.results) ? (rows[0].results as TopicGapItem[]) : [];
      const hidden = Array.isArray(rows[0]?.excludedResults) ? (rows[0].excludedResults as TopicGapItem[]) : [];
      const toHide = results.filter(isExcluded);
      const toRestore = hidden.filter((i) => !isExcluded(i));
      if (toHide.length === 0 && toRestore.length === 0) return;

      const nextResults = [...results.filter((i) => !isExcluded(i)), ...toRestore];
      const nextHidden = [...hidden.filter(isExcluded), ...toHide];
      await tx.keywordMapTopicGap.update({
        where: { id: g.id },
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
  return { brands, ...(await applyTopicExclusion({ brands })) };
}

/** Sperrt Topics für ein Projekt und blendet sie in allen Gap-Analysen des Projekts aus */
export async function blockTopics(projectId: string, topics: string[], userId: string) {
  const byKey = new Map<string, string>();
  for (const t of topics) {
    const key = topicKey(t);
    if (key && !byKey.has(key)) byKey.set(key, t.trim());
  }
  await prisma.keywordMapTopicBlock.createMany({
    data: [...byKey].map(([key, topic]) => ({ projectId, key, topic, createdById: userId })),
    skipDuplicates: true,
  });
  return { blocked: byKey.size, ...(await applyTopicExclusion({ projectId })) };
}

/** Hebt Sperren auf und holt die Topics in die Gap-Analysen des Projekts zurück */
export async function unblockTopics(projectId: string, keys: string[]) {
  await prisma.keywordMapTopicBlock.deleteMany({ where: { projectId, key: { in: keys } } });
  return applyTopicExclusion({ projectId });
}
