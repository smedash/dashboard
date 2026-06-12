/**
 * Batch-Research-Skript: Holt fuer alle Seed-Keywords aus der DB
 * automatisiert Topics, FAQs und Keywords.
 *
 * Nutzung:
 *   npx tsx scripts/batch-research.ts
 *   npx tsx scripts/batch-research.ts --category "Hypotheken und Finanzierungen"
 *   npx tsx scripts/batch-research.ts --only topics
 *   npx tsx scripts/batch-research.ts --only questions
 *   npx tsx scripts/batch-research.ts --only keywords
 *   npx tsx scripts/batch-research.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const prisma = new PrismaClient();

const TOPICLOOPS_API_URL = "https://api.topicloops.com/v1";
const SEOSPARK_API_URL = "https://api.seospark.io/v1/keywords/suggest";

const DELAY_MS = 2000;
const TOPIC_POLL_INTERVAL_MS = 3000;
const TOPIC_POLL_MAX_ATTEMPTS = 40; // ~2 Minuten

// --- CLI Args ---
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}
const categoryFilter = getArg("category");
const onlyType = getArg("only") as "topics" | "questions" | "keywords" | undefined;
const dryRun = args.includes("--dry-run");

// --- Helpers ---
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countTopics(node: { children?: unknown[] }): number {
  let count = 1;
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countTopics(child as { children?: unknown[] });
    }
  }
  return count;
}

// --- Topics (TopicLoops) ---
async function fetchTopics(keyword: string, category: string): Promise<string> {
  const apiKey = process.env.TOPICLOOPS_API_KEY;
  if (!apiKey) return "SKIP (kein TOPICLOOPS_API_KEY)";

  const existing = await prisma.topicGraph.findUnique({
    where: { keyword_countryCode_languageCode: { keyword, countryCode: "ch", languageCode: "de" } },
  });

  if (existing?.status === "succeeded" && existing.topicGraph) {
    if (category && !existing.category) {
      await prisma.topicGraph.update({ where: { id: existing.id }, data: { category } });
    }
    return "CACHED";
  }

  const createRes = await fetch(`${TOPICLOOPS_API_URL}/topic-graphs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ keyword, country_code: "ch", language_code: "de" }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    return `FEHLER (${createRes.status}: ${errText.slice(0, 100)})`;
  }

  const createJson = await createRes.json();
  if (createJson.status !== "success") return `FEHLER (${createJson.message})`;

  const jobId = createJson.data.id;

  // Admin-User fuer die userId (bevorzugt admin_nico_contentking)
  const adminUser = await prisma.user.findFirst({
    where: { id: "admin_nico_contentking" },
  }) || await prisma.user.findFirst();
  const userId = adminUser?.id || "system";

  await prisma.topicGraph.upsert({
    where: { keyword_countryCode_languageCode: { keyword, countryCode: "ch", languageCode: "de" } },
    create: {
      userId,
      keyword,
      countryCode: "ch",
      languageCode: "de",
      topicloopsId: jobId,
      status: "processing",
      category,
    },
    update: { topicloopsId: jobId, status: "processing", category },
  });

  // Polling
  for (let i = 0; i < TOPIC_POLL_MAX_ATTEMPTS; i++) {
    await sleep(TOPIC_POLL_INTERVAL_MS);

    const pollRes = await fetch(`${TOPICLOOPS_API_URL}/topic-graphs/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) continue;

    const pollJson = await pollRes.json();
    if (pollJson.status !== "success") continue;

    const data = pollJson.data;

    if (data.status === "succeeded" && data.topic_graph) {
      const total = countTopics(data.topic_graph);
      await prisma.topicGraph.update({
        where: { keyword_countryCode_languageCode: { keyword, countryCode: "ch", languageCode: "de" } },
        data: {
          status: "succeeded",
          topicGraph: JSON.stringify(data.topic_graph),
          totalTopics: total,
          category,
        },
      });
      return `OK (${total} Topics)`;
    }

    if (data.status === "failed") {
      await prisma.topicGraph.update({
        where: { keyword_countryCode_languageCode: { keyword, countryCode: "ch", languageCode: "de" } },
        data: { status: "failed" },
      });
      return "FEHLGESCHLAGEN";
    }
  }

  return "TIMEOUT";
}

// --- Questions (Anthropic) ---
async function fetchQuestions(keyword: string, category: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "SKIP (kein ANTHROPIC_API_KEY)";

  const existing = await prisma.keywordQuestion.findUnique({ where: { keyword } });
  if (existing) {
    if (category && !existing.category) {
      await prisma.keywordQuestion.update({ where: { id: existing.id }, data: { category } });
    }
    return "CACHED";
  }

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Generiere die 20 häufigsten und relevantesten Fragen, die Nutzer zu dem Keyword "${keyword}" stellen. Die Fragen sollen typische Suchanfragen widerspiegeln, die echte Nutzer in Google eingeben würden.

Antworte ausschließlich mit einem JSON-Array von 20 Strings, ohne zusätzlichen Text oder Erklärungen. Beispielformat:
["Frage 1?", "Frage 2?", ...]

Die Fragen sollen auf Deutsch sein, es sei denn das Keyword ist eindeutig englischsprachig.`,
      },
    ],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") return "FEHLER (keine Antwort)";

  const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return "FEHLER (kein JSON)";

  let questions: string[];
  try {
    questions = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(questions)) throw new Error();
  } catch {
    return "FEHLER (JSON parse)";
  }

  await prisma.keywordQuestion.create({
    data: { keyword, questions: JSON.stringify(questions), category },
  });

  return `OK (${questions.length} Fragen)`;
}

// --- Keywords (SEOspark) ---
async function fetchKeywords(keyword: string, category: string): Promise<string> {
  const apiKey = process.env.SEOSPARK_API_KEY;
  if (!apiKey) return "SKIP (kein SEOSPARK_API_KEY)";

  const existing = await prisma.keywordSuggestion.findUnique({
    where: { keyword_countryCode_languageCode: { keyword, countryCode: "ch", languageCode: "de" } },
  });

  if (existing) {
    if (category && !existing.category) {
      await prisma.keywordSuggestion.update({ where: { id: existing.id }, data: { category } });
    }
    return "CACHED";
  }

  const seosparkRes = await fetch(SEOSPARK_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
    },
    body: JSON.stringify({
      country_code: "ch",
      language_code: "de",
      keyword,
      page_size: 100,
      sort: "searchVolume,desc",
    }),
  });

  if (!seosparkRes.ok) {
    const errText = await seosparkRes.text();
    return `FEHLER (${seosparkRes.status}: ${errText.slice(0, 100)})`;
  }

  const seosparkData = await seosparkRes.json();
  if (seosparkData.status !== "success") return `FEHLER (${seosparkData.message})`;

  const items = seosparkData.data?.keywords?.items || [];
  const totalCount = seosparkData.data?.keywords?.meta?.total_count || 0;

  const suggestions = items.map((item: { keyword: string; metrics?: { average_search_volume?: number; cpc?: number; competition?: number; keyword_difficulty?: number; search_intents?: string[]; serp_item_types?: string[] } }) => ({
    keyword: item.keyword,
    searchVolume: item.metrics?.average_search_volume ?? null,
    cpc: item.metrics?.cpc ?? null,
    competition: item.metrics?.competition ?? null,
    difficulty: item.metrics?.keyword_difficulty ?? null,
    searchIntents: item.metrics?.search_intents ?? null,
    serpItemTypes: item.metrics?.serp_item_types ?? [],
  }));

  await prisma.keywordSuggestion.create({
    data: {
      keyword,
      countryCode: "ch",
      languageCode: "de",
      totalCount,
      suggestions: JSON.stringify(suggestions),
      category,
    },
  });

  return `OK (${suggestions.length} Keywords, ${totalCount} total)`;
}

// --- Main ---
async function main() {
  console.log("🚀 Batch-Research gestartet\n");

  if (dryRun) console.log("⚠️  DRY-RUN Modus — es werden keine API-Calls gemacht\n");
  if (categoryFilter) console.log(`📁 Kategorie-Filter: "${categoryFilter}"\n`);
  if (onlyType) console.log(`🎯 Nur: ${onlyType}\n`);

  const where = categoryFilter ? { category: categoryFilter } : {};
  const seedKeywords = await prisma.seedKeyword.findMany({
    where,
    orderBy: [{ category: "asc" }, { keyword: "asc" }],
  });

  if (seedKeywords.length === 0) {
    console.error("❌ Keine Seed-Keywords gefunden. Hast du das Import-Skript ausgefuehrt?");
    console.error("   npx tsx scripts/import-seed-keywords.ts /pfad/zur/excel.xlsx");
    process.exit(1);
  }

  console.log(`📊 ${seedKeywords.length} Seed-Keywords geladen\n`);

  const stats = {
    topics: { ok: 0, cached: 0, error: 0, skip: 0 },
    questions: { ok: 0, cached: 0, error: 0, skip: 0 },
    keywords: { ok: 0, cached: 0, error: 0, skip: 0 },
  };

  for (let i = 0; i < seedKeywords.length; i++) {
    const sk = seedKeywords[i];
    const num = `[${i + 1}/${seedKeywords.length}]`;
    const normalizedKw = sk.keyword.trim().toLowerCase();

    process.stdout.write(`${num} "${sk.keyword}" (${sk.category})`);

    if (dryRun) {
      console.log(" — DRY RUN");
      continue;
    }

    const results: string[] = [];

    // Topics
    if (!onlyType || onlyType === "topics") {
      const topicResult = await fetchTopics(normalizedKw, sk.category);
      results.push(`Topics: ${topicResult}`);
      if (topicResult.startsWith("OK")) stats.topics.ok++;
      else if (topicResult === "CACHED") stats.topics.cached++;
      else if (topicResult.startsWith("SKIP")) stats.topics.skip++;
      else stats.topics.error++;
    }

    // Questions
    if (!onlyType || onlyType === "questions") {
      const questionResult = await fetchQuestions(normalizedKw, sk.category);
      results.push(`Questions: ${questionResult}`);
      if (questionResult.startsWith("OK")) stats.questions.ok++;
      else if (questionResult === "CACHED") stats.questions.cached++;
      else if (questionResult.startsWith("SKIP")) stats.questions.skip++;
      else stats.questions.error++;
      await sleep(DELAY_MS);
    }

    // Keywords
    if (!onlyType || onlyType === "keywords") {
      const keywordResult = await fetchKeywords(normalizedKw, sk.category);
      results.push(`Keywords: ${keywordResult}`);
      if (keywordResult.startsWith("OK")) stats.keywords.ok++;
      else if (keywordResult === "CACHED") stats.keywords.cached++;
      else if (keywordResult.startsWith("SKIP")) stats.keywords.skip++;
      else stats.keywords.error++;
      await sleep(DELAY_MS);
    }

    console.log(` — ${results.join(" | ")}`);
  }

  // Zusammenfassung
  console.log("\n" + "=".repeat(60));
  console.log("📋 ZUSAMMENFASSUNG");
  console.log("=".repeat(60));

  if (!onlyType || onlyType === "topics") {
    const t = stats.topics;
    console.log(`\n🌳 Topics:    ${t.ok} neu | ${t.cached} cached | ${t.error} Fehler | ${t.skip} uebersprungen`);
  }
  if (!onlyType || onlyType === "questions") {
    const q = stats.questions;
    console.log(`❓ Questions: ${q.ok} neu | ${q.cached} cached | ${q.error} Fehler | ${q.skip} uebersprungen`);
  }
  if (!onlyType || onlyType === "keywords") {
    const k = stats.keywords;
    console.log(`🔑 Keywords:  ${k.ok} neu | ${k.cached} cached | ${k.error} Fehler | ${k.skip} uebersprungen`);
  }

  console.log("\n✅ Batch-Research abgeschlossen");
}

main()
  .catch((error) => {
    console.error("\n❌ Fataler Fehler:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
