import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 600;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const BATCH_SIZE = 60;
const CONCURRENCY = 10;

type ArticleRow = {
  id: string;
  title: string;
  url: string | null;
  metaDescription: string | null;
  h1: string | null;
  category: string | null;
  location: string | null;
};

type AnalysisResult = {
  id: string;
  focusKeywords: string[];
  reasoning: string;
};

function computeOverlaps(
  results: AnalysisResult[],
  articles: Array<{ id: string; title: string; url: string | null; location: string | null }>
) {
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const keywordMap = new Map<string, Array<{ id: string; title: string; url: string | null; location: string | null }>>();

  for (const result of results) {
    const article = articleById.get(result.id);
    if (!article) continue;

    for (const keyword of result.focusKeywords) {
      const normalized = keyword.toLowerCase().trim();
      if (!keywordMap.has(normalized)) {
        keywordMap.set(normalized, []);
      }
      keywordMap.get(normalized)!.push({
        id: article.id,
        title: article.title,
        url: article.url,
        location: article.location,
      });
    }
  }

  const overlaps: Array<{
    keyword: string;
    articles: Array<{ id: string; title: string; url: string | null; location: string | null }>;
  }> = [];

  for (const [keyword, mappedArticles] of keywordMap.entries()) {
    const byId = new Map<
      string,
      { id: string; title: string; url: string | null; location: string | null }
    >();
    for (const a of mappedArticles) {
      const prev = byId.get(a.id);
      if (!prev) {
        byId.set(a.id, { ...a });
      } else {
        byId.set(a.id, {
          id: a.id,
          title: (prev.title || a.title)?.trim() || prev.title || a.title,
          url: prev.url || a.url,
          location: prev.location ?? a.location,
        });
      }
    }
    const uniq = [...byId.values()];
    if (uniq.length > 1) {
      overlaps.push({ keyword, articles: uniq });
    }
  }

  overlaps.sort((a, b) => b.articles.length - a.articles.length);
  return overlaps;
}

async function analyzeBatch(batch: ArticleRow[]): Promise<AnalysisResult[]> {
  const articleList = batch
    .map(
      (a, idx) =>
        `${idx + 1}. [ID: ${a.id}]${a.url ? ` URL: ${a.url}` : ""}
   Title: "${a.title}"${a.h1 ? `\n   H1: "${a.h1}"` : ""}${a.metaDescription ? `\n   Meta-Description: "${a.metaDescription.substring(0, 300)}"` : ""}${a.category ? `\n   Kategorie: ${a.category}` : ""}`
    )
    .join("\n\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Du bist ein erfahrener SEO-Experte für Finanzthemen in der Schweiz (Hypotheken, Vorsorge, Investing, Banking).

Analysiere die folgenden Artikel anhand von Title, H1 und Meta-Description. Bestimme für jeden Artikel 1-2 Fokuskeywords, für die die jeweilige URL realistisch ranken könnte.

Regeln für die Fokuskeyword-Bestimmung:
- Fokuskeywords sollten reale Suchbegriffe sein, die Nutzer in Google eingeben würden
- Bevorzuge Keywords mit 2-4 Wörtern (nicht zu generisch, nicht zu lang)
- Berücksichtige den Schweizer Markt (z.B. "Hypothek" statt "Baufinanzierung", "Säule 3a" statt "Riester")
- Das Fokuskeyword muss zum Inhalt der Seite passen (basierend auf Title, H1, Meta-Description)
- Wenn Title und H1 unterschiedliche Schwerpunkte haben, wähle das übergeordnete Keyword

Artikel:
${articleList}

Antworte NUR mit einem JSON-Array im folgenden Format (keine weiteren Erklärungen):
[
  {"id": "...", "focusKeywords": ["keyword1", "keyword2"], "reasoning": "Kurze Begründung (max 15 Wörter)"}
]

Wichtig: Jeder Eintrag muss mindestens 1 und maximal 2 focusKeywords haben. Alle Keywords in Kleinbuchstaben.`,
      },
    ],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") return [];

  const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      id: string;
      focusKeywords: string[];
      reasoning: string;
    }>;

    const batchIds = new Set(batch.map((a) => a.id));
    return parsed
      .filter((r) => batchIds.has(r.id) && Array.isArray(r.focusKeywords) && r.focusKeywords.length > 0)
      .map((r) => ({
        id: r.id,
        focusKeywords: r.focusKeywords.slice(0, 2).map((k) => k.toLowerCase().trim()),
        reasoning: r.reasoning || "",
      }));
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const latestRun = await prisma.keywordMappingRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        analyzed: true,
        total: true,
        createdAt: true,
        results: {
          select: {
            articleId: true,
            focusKeywords: true,
            reasoning: true,
          },
        },
      },
    });

    if (!latestRun) {
      return NextResponse.json(
        { run: null },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    const articleIds = latestRun.results.map((r) => r.articleId);
    const articles = await prisma.editorialPlanArticle.findMany({
      where: { id: { in: articleIds } },
      select: { id: true, title: true, url: true, location: true },
    });

    const results = latestRun.results.map((r) => ({
      id: r.articleId,
      focusKeywords: JSON.parse(r.focusKeywords) as string[],
      reasoning: r.reasoning || "",
    }));

    const overlaps = computeOverlaps(results, articles);

    return NextResponse.json(
      {
        run: {
          id: latestRun.id,
          analyzed: latestRun.analyzed,
          total: latestRun.total,
          createdAt: latestRun.createdAt.toISOString(),
          results,
          overlaps,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching keyword mapping:", error);
    return NextResponse.json({ error: "Laden fehlgeschlagen" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { articleIds } = body as { articleIds?: string[] };

  const where: Record<string, unknown> = {};
  if (articleIds && articleIds.length > 0) {
    where.id = { in: articleIds };
  }

  const articles = await prisma.editorialPlanArticle.findMany({
    where,
    select: {
      id: true,
      title: true,
      url: true,
      metaDescription: true,
      h1: true,
      category: true,
      location: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (articles.length === 0) {
    return NextResponse.json({
      analyzed: 0,
      message: "Keine Artikel zur Analyse gefunden.",
      results: [],
      overlaps: [],
    });
  }

  const batches: ArticleRow[][] = [];
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    batches.push(articles.slice(i, i + BATCH_SIZE));
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = async (data: Record<string, unknown>) => {
    await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
  };

  (async () => {
    const allResults: AnalysisResult[] = [];
    let analyzedCount = 0;
    let failedBatches = 0;

    try {
      await send({ type: "progress", analyzed: 0, total: articles.length, batches: batches.length });

      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        const group = batches.slice(i, i + CONCURRENCY);

        const settled = await Promise.allSettled(
          group.map((batch) => analyzeBatch(batch))
        );

        for (const result of settled) {
          if (result.status === "fulfilled") {
            allResults.push(...result.value);
          } else {
            failedBatches++;
            console.error("Batch failed:", result.reason);
          }
        }

        analyzedCount += group.reduce((sum, b) => sum + b.length, 0);
        await send({
          type: "progress",
          analyzed: Math.min(analyzedCount, articles.length),
          total: articles.length,
          results: allResults.length,
          failed: failedBatches,
        });
      }

      const run = await prisma.keywordMappingRun.create({
        data: {
          analyzed: allResults.length,
          total: articles.length,
          results: {
            create: allResults.map((r) => ({
              articleId: r.id,
              focusKeywords: JSON.stringify(r.focusKeywords),
              reasoning: r.reasoning,
            })),
          },
        },
      });

      const overlaps = computeOverlaps(allResults, articles);

      await send({
        type: "complete",
        data: {
          id: run.id,
          analyzed: allResults.length,
          total: articles.length,
          createdAt: run.createdAt.toISOString(),
          results: allResults,
          overlaps,
        },
      });
    } catch (error) {
      console.error("Analysis stream error:", error);
      await send({
        type: "error",
        message: error instanceof Error ? error.message : "Keyword-Analyse fehlgeschlagen",
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
