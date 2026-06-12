import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      topicGraphs,
      keywordQuestions,
      keywordSuggestions,
      seedKeywords,
      intentCounts,
      trendCounts,
      keywordVolumes,
      totalTrends,
      totalIntents,
      totalVolumes,
    ] = await Promise.all([
      prisma.topicGraph.findMany({
        where: { status: "succeeded" },
        select: {
          keyword: true,
          totalTopics: true,
          topicGraph: true,
          category: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      prisma.keywordQuestion.findMany({
        select: {
          keyword: true,
          questions: true,
          category: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),

      prisma.keywordSuggestion.findMany({
        select: {
          keyword: true,
          totalCount: true,
          suggestions: true,
          category: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      prisma.seedKeyword.findMany({
        select: { keyword: true, category: true, fullName: true },
      }),

      prisma.searchIntent.groupBy({
        by: ["intentLabel"],
        _count: { id: true },
      }),

      prisma.googleTrend.groupBy({
        by: ["trendDirection"],
        _count: { id: true },
      }),

      prisma.keywordVolume.findMany({
        where: { searchVolume: { gt: 0 } },
        select: {
          keyword: true,
          searchVolume: true,
          cpc: true,
          competition: true,
        },
        orderBy: { searchVolume: "desc" },
        take: 200,
      }),

      prisma.googleTrend.count(),
      prisma.searchIntent.count(),
      prisma.keywordVolume.count(),
    ]);

    type SuggestionItem = {
      keyword?: string;
      searchVolume?: number | null;
      difficulty?: number | null;
      cpc?: number | null;
      searchIntents?: string[] | null;
    };

    const topKeywordSuggestions: SuggestionItem[] = [];
    for (const ks of keywordSuggestions) {
      const items = JSON.parse(ks.suggestions) as SuggestionItem[];
      const topItems = items
        .filter((s) => s.searchVolume != null && s.searchVolume! > 0)
        .sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0))
        .slice(0, 10);
      topKeywordSuggestions.push(...topItems);
    }

    const topicSummaries = topicGraphs.map((tg) => {
      let subtopics: string[] = [];
      if (tg.topicGraph) {
        try {
          const graph = JSON.parse(tg.topicGraph);
          if (graph.children) {
            subtopics = graph.children
              .slice(0, 5)
              .map((c: { name?: string }) => c.name || "");
          }
        } catch {
          // ignore parse errors
        }
      }
      return {
        keyword: tg.keyword,
        totalTopics: tg.totalTopics,
        category: tg.category,
        topSubtopics: subtopics,
      };
    });

    const questionSummaries = keywordQuestions.map((kq) => {
      let questions: string[] = [];
      try {
        questions = JSON.parse(kq.questions) as string[];
      } catch {
        // ignore
      }
      return {
        keyword: kq.keyword,
        category: kq.category,
        topQuestions: questions.slice(0, 5),
      };
    });

    const categories = [...new Set(seedKeywords.map((sk) => sk.category))];
    const seedByCategory = categories.map((cat) => ({
      category: cat,
      keywords: seedKeywords
        .filter((sk) => sk.category === cat)
        .map((sk) => sk.keyword),
    }));

    const intentDistribution = intentCounts.map((ic) => ({
      label: ic.intentLabel,
      count: ic._count.id,
    }));

    const trendDistribution = trendCounts
      .filter((tc) => tc.trendDirection != null)
      .map((tc) => ({
        direction: tc.trendDirection!,
        count: tc._count.id,
      }));

    return NextResponse.json({
      summary: {
        totalTopicGraphs: topicGraphs.length,
        totalQuestionSets: keywordQuestions.length,
        totalKeywordSuggestions: topKeywordSuggestions.length,
        totalKeywordVolumes: totalVolumes,
        totalTrends,
        totalIntents,
        categories,
      },
      topics: topicSummaries,
      questions: questionSummaries,
      keywords: {
        topByVolume: keywordVolumes.slice(0, 50).map((kv) => ({
          keyword: kv.keyword,
          searchVolume: kv.searchVolume,
          cpc: kv.cpc,
          competition: kv.competition,
        })),
        topSuggestions: topKeywordSuggestions
          .sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0))
          .slice(0, 50),
      },
      gscInsights: {
        intentDistribution,
        trendDistribution,
      },
      seedKeywords: seedByCategory,
    });
  } catch (error) {
    console.error("Marketing AI data API error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Daten" },
      { status: 500 }
    );
  }
}
