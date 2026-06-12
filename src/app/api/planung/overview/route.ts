import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [
      topicGraphs,
      keywordQuestions,
      keywordSuggestions,
      seedKeywords,
      intentCounts,
      trendCounts,
      totalTrends,
      totalIntents,
      totalVolumes,
    ] = await Promise.all([
      prisma.topicGraph.findMany({
        select: {
          id: true,
          keyword: true,
          status: true,
          totalTopics: true,
          category: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),

      prisma.keywordQuestion.findMany({
        select: {
          id: true,
          keyword: true,
          questions: true,
          category: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),

      prisma.keywordSuggestion.findMany({
        select: {
          id: true,
          keyword: true,
          totalCount: true,
          suggestions: true,
          category: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),

      prisma.seedKeyword.groupBy({
        by: ["category"],
        _count: { id: true },
      }),

      prisma.searchIntent.groupBy({
        by: ["intentLabel"],
        _count: { id: true },
      }),

      prisma.googleTrend.groupBy({
        by: ["trendDirection"],
        _count: { id: true },
      }),

      prisma.googleTrend.count(),
      prisma.searchIntent.count(),
      prisma.keywordVolume.count(),
    ]);

    const gscKeywordCount = Math.max(totalTrends, totalIntents, totalVolumes);

    const topicStats = {
      total: topicGraphs.length,
      succeeded: topicGraphs.filter((t) => t.status === "succeeded").length,
      totalTopics: topicGraphs.reduce((sum, t) => sum + t.totalTopics, 0),
      byCategory: Object.entries(
        topicGraphs
          .filter((t) => t.category)
          .reduce<Record<string, { count: number; topics: number }>>((acc, t) => {
            const cat = t.category!;
            if (!acc[cat]) acc[cat] = { count: 0, topics: 0 };
            acc[cat].count++;
            acc[cat].topics += t.totalTopics;
            return acc;
          }, {})
      ).map(([category, data]) => ({ category, ...data })),
    };

    const questionStats = {
      total: keywordQuestions.length,
      totalQuestions: keywordQuestions.reduce((sum, q) => {
        const arr = JSON.parse(q.questions) as string[];
        return sum + arr.length;
      }, 0),
      byCategory: Object.entries(
        keywordQuestions
          .filter((q) => q.category)
          .reduce<Record<string, { count: number; questions: number }>>((acc, q) => {
            const cat = q.category!;
            if (!acc[cat]) acc[cat] = { count: 0, questions: 0 };
            acc[cat].count++;
            acc[cat].questions += (JSON.parse(q.questions) as string[]).length;
            return acc;
          }, {})
      ).map(([category, data]) => ({ category, ...data })),
    };

    type SuggestionItem = {
      searchVolume?: number | null;
      difficulty?: number | null;
      cpc?: number | null;
      searchIntents?: string[] | null;
    };

    const allSuggestions: SuggestionItem[] = [];
    for (const ks of keywordSuggestions) {
      const items = JSON.parse(ks.suggestions) as SuggestionItem[];
      allSuggestions.push(...items);
    }

    const withVolume = allSuggestions.filter((s) => s.searchVolume != null && s.searchVolume! > 0);
    const withDifficulty = allSuggestions.filter((s) => s.difficulty != null);

    const difficultyBuckets = { easy: 0, medium: 0, hard: 0 };
    for (const s of withDifficulty) {
      const d = s.difficulty!;
      if (d <= 30) difficultyBuckets.easy++;
      else if (d <= 60) difficultyBuckets.medium++;
      else difficultyBuckets.hard++;
    }

    const intentFromSuggestions: Record<string, number> = {};
    for (const s of allSuggestions) {
      if (s.searchIntents) {
        for (const intent of s.searchIntents) {
          intentFromSuggestions[intent] = (intentFromSuggestions[intent] || 0) + 1;
        }
      }
    }

    const keywordStats = {
      totalResearched: keywordSuggestions.length,
      totalSuggestions: allSuggestions.length,
      avgSearchVolume:
        withVolume.length > 0
          ? Math.round(withVolume.reduce((sum, s) => sum + (s.searchVolume || 0), 0) / withVolume.length)
          : 0,
      difficultyDistribution: difficultyBuckets,
      intentDistribution: intentFromSuggestions,
      byCategory: Object.entries(
        keywordSuggestions
          .filter((ks) => ks.category)
          .reduce<Record<string, { count: number; suggestions: number }>>((acc, ks) => {
            const cat = ks.category!;
            if (!acc[cat]) acc[cat] = { count: 0, suggestions: 0 };
            acc[cat].count++;
            acc[cat].suggestions += ks.totalCount;
            return acc;
          }, {})
      ).map(([category, data]) => ({ category, ...data })),
    };

    const gscStats = {
      gscKeywordCount,
      totalTrends,
      totalIntents,
      totalVolumes,
      intentDistribution: intentCounts.map((ic) => ({
        label: ic.intentLabel,
        count: ic._count.id,
      })),
      trendDistribution: trendCounts
        .filter((tc) => tc.trendDirection != null)
        .map((tc) => ({
          direction: tc.trendDirection!,
          count: tc._count.id,
        })),
    };

    const seedStats = seedKeywords.map((sk) => ({
      category: sk.category,
      count: sk._count.id,
    }));

    return NextResponse.json({
      topicStats,
      questionStats,
      keywordStats,
      gscStats,
      seedStats,
    });
  } catch (error) {
    console.error("Overview API error:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Übersicht" }, { status: 500 });
  }
}
