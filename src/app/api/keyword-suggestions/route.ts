import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const SEOSPARK_API_URL = "https://api.seospark.io/v1/keywords/suggest";

interface SeosparkKeywordItem {
  keyword: string;
  metrics: {
    updated_at: string;
    average_search_volume: number | null;
    competition: number | null;
    cpc: number | null;
    keyword_difficulty: number | null;
    search_intents: string[] | null;
    serp_item_types: string[];
    serp_results_count: number | null;
    daily_impressions_average: number | null;
    search_volume_history: { period_start: string; value: number }[];
  } | null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { keyword, country_code, language_code } = body;

    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
      return NextResponse.json({ error: "Keyword ist erforderlich" }, { status: 400 });
    }

    const normalizedKeyword = keyword.trim().toLowerCase();
    const cc = country_code ?? "ch";
    const lc = language_code ?? "de";

    const existing = await prisma.keywordSuggestion.findUnique({
      where: {
        keyword_countryCode_languageCode: {
          keyword: normalizedKeyword,
          countryCode: cc,
          languageCode: lc,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        id: existing.id,
        keyword: existing.keyword,
        countryCode: existing.countryCode,
        languageCode: existing.languageCode,
        totalCount: existing.totalCount,
        suggestions: JSON.parse(existing.suggestions),
        createdAt: existing.createdAt.toISOString(),
        cached: true,
      });
    }

    const apiKey = process.env.SEOSPARK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "SEOSPARK_API_KEY nicht konfiguriert" }, { status: 500 });
    }

    const seosparkRes = await fetch(SEOSPARK_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
      },
      body: JSON.stringify({
        country_code: cc,
        language_code: lc,
        keyword: normalizedKeyword,
        page_size: 100,
        sort: "searchVolume,desc",
      }),
    });

    if (!seosparkRes.ok) {
      const errData = await seosparkRes.json().catch(() => null);
      const errMsg = errData?.message || `SEOspark API Fehler: ${seosparkRes.status}`;
      return NextResponse.json({ error: errMsg }, { status: seosparkRes.status });
    }

    const seosparkData = await seosparkRes.json();

    if (seosparkData.status !== "success") {
      return NextResponse.json(
        { error: seosparkData.message || "SEOspark API Fehler" },
        { status: 500 }
      );
    }

    const items: SeosparkKeywordItem[] = seosparkData.data?.keywords?.items || [];
    const totalCount = seosparkData.data?.keywords?.meta?.total_count || 0;

    const suggestions = items.map((item) => ({
      keyword: item.keyword,
      searchVolume: item.metrics?.average_search_volume ?? null,
      cpc: item.metrics?.cpc ?? null,
      competition: item.metrics?.competition ?? null,
      difficulty: item.metrics?.keyword_difficulty ?? null,
      searchIntents: item.metrics?.search_intents ?? null,
      serpItemTypes: item.metrics?.serp_item_types ?? [],
    }));

    const saved = await prisma.keywordSuggestion.create({
      data: {
        keyword: normalizedKeyword,
        countryCode: cc,
        languageCode: lc,
        totalCount,
        suggestions: JSON.stringify(suggestions),
      },
    });

    return NextResponse.json({
      id: saved.id,
      keyword: saved.keyword,
      countryCode: saved.countryCode,
      languageCode: saved.languageCode,
      totalCount: saved.totalCount,
      suggestions,
      createdAt: saved.createdAt.toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error("Keyword Suggestions API error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const all = await prisma.keywordSuggestion.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      all.map((item) => ({
        id: item.id,
        keyword: item.keyword,
        countryCode: item.countryCode,
        languageCode: item.languageCode,
        totalCount: item.totalCount,
        suggestions: JSON.parse(item.suggestions),
        createdAt: item.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Keyword Suggestions GET error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
    }

    await prisma.keywordSuggestion.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Keyword Suggestions DELETE error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
