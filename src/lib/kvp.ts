import { prisma } from "@/lib/prisma";

export { KVP_CATEGORIES, isValidKvpCategory } from "@/lib/kvp-categories";

/**
 * Legt Fokus- und Subkeywords eines KVP im Rank Tracker des Users an
 * bzw. setzt targetUrl/Kategorie bei bereits vorhandenen Keywords.
 */
export async function syncKvpRankTrackerKeywords(params: {
  userId: string;
  url: string;
  keywords: string[];
  category?: string | null;
}) {
  const { userId, category } = params;
  const url = params.url.trim();

  let tracker = await prisma.rankTracker.findFirst({ where: { userId } });
  if (!tracker) {
    tracker = await prisma.rankTracker.create({
      data: {
        userId,
        name: "Standard Tracker",
        location: "Switzerland",
        language: "German",
      },
    });
  }

  const addedKeywords = [];
  for (const raw of params.keywords) {
    const keyword = raw.trim();
    if (!keyword) continue;

    const existingKeyword = await prisma.rankTrackerKeyword.findUnique({
      where: { trackerId_keyword: { trackerId: tracker.id, keyword } },
    });

    if (!existingKeyword) {
      try {
        const rankKeyword = await prisma.rankTrackerKeyword.create({
          data: {
            trackerId: tracker.id,
            keyword,
            targetUrl: url,
            category: category || null,
          },
        });
        addedKeywords.push(rankKeyword);
      } catch {
        // Race Condition: Keyword wurde parallel angelegt
        console.log(`Keyword "${keyword}" konnte nicht hinzugefügt werden, möglicherweise bereits vorhanden`);
      }
    } else {
      const updateData: { targetUrl?: string; category?: string | null } = {};
      if (!existingKeyword.targetUrl || existingKeyword.targetUrl !== url) {
        updateData.targetUrl = url;
      }
      if (category && existingKeyword.category !== category) {
        updateData.category = category;
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.rankTrackerKeyword.update({
          where: { id: existingKeyword.id },
          data: updateData,
        });
      }
      addedKeywords.push(existingKeyword);
    }
  }

  return addedKeywords;
}
