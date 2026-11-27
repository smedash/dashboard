import { prisma } from "@/lib/prisma";
import { type ProjectTopicGap, type ProjectTopicGapsResponse, type TopicGapItem, topicKey } from "./shared";

/**
 * Projektweit offene Topics: auf der eigenen URL fehlend und laut Abgleich mit dem Content-Mapping
 * auf keiner anderen URL (ganz oder teilweise) abgedeckt. Topics mit gleichem Namen werden zusammengefasst
 * und fallen weg, sobald sie in irgendeiner Analyse des Projekts als (teilweise) abgedeckt gelten.
 */
export async function loadProjectTopicGaps(projectId: string): Promise<ProjectTopicGapsResponse> {
  const urls = await prisma.keywordMapUrl.findMany({
    where: { projectId },
    select: {
      id: true,
      url: true,
      topicGaps: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, focusKeyword: true, results: true, crossCoverageError: true },
      },
    },
    orderBy: { url: "asc" },
  });

  const groups = new Map<string, ProjectTopicGap>();
  const coveredSomewhere = new Set<string>();
  let analyzed = 0;
  let unchecked = 0;

  for (const u of urls) {
    const gap = u.topicGaps[0];
    if (!gap || gap.status !== "succeeded" || !Array.isArray(gap.results)) continue;
    analyzed++;
    const items = gap.results as unknown as TopicGapItem[];
    const checked = !gap.crossCoverageError && items.every((i) => i.status === "covered" || i.otherUrls !== undefined);
    if (!checked) unchecked++;

    items.forEach((item, index) => {
      const key = topicKey(item.topic ?? "");
      if (!key) return;
      if (item.status !== "missing" || (item.otherUrls?.length ?? 0) > 0) {
        coveredSomewhere.add(key);
        return;
      }
      if (!checked) return;
      let group = groups.get(key);
      if (!group) {
        group = { key, topic: item.topic, occurrences: [] };
        groups.set(key, group);
      }
      group.occurrences.push({
        urlId: u.id,
        url: u.url,
        focusKeyword: gap.focusKeyword,
        gapId: gap.id,
        index,
        path: item.path ?? [],
        reason: item.reason ?? "",
        editorialArticleId: item.editorialArticleId ?? null,
      });
    });
  }

  const gaps = [...groups.values()]
    .filter((g) => !coveredSomewhere.has(g.key))
    .sort((a, b) => b.occurrences.length - a.occurrences.length || a.topic.localeCompare(b.topic));

  return { gaps, stats: { urls: urls.length, analyzed, unchecked } };
}
