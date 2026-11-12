import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getKeywordSuggestions, SeosparkError } from "@/lib/seospark";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { keyword, country_code, language_code, category } = body;

    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
      return NextResponse.json({ error: "Keyword ist erforderlich" }, { status: 400 });
    }

    const result = await getKeywordSuggestions(keyword, {
      countryCode: country_code,
      languageCode: language_code,
      category,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SeosparkError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
        category: item.category,
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
