import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiRateLimiter } from "@/lib/rate-limit";
import { proxyFetch, DEFAULT_SCRAPE_HEADERS } from "@/lib/proxy-fetch";
import OpenAI from "openai";

function extractTextContent(html: string): { text: string; title: string; metaDescription: string; headings: { level: number; text: string }[] } {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || "";

  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const metaDescription = metaMatch?.[1]?.trim() || "";

  const headings: { level: number; text: string }[] = [];
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hMatch;
  while ((hMatch = headingRegex.exec(html)) !== null) {
    headings.push({ level: parseInt(hMatch[1]), text: hMatch[2].replace(/<[^>]*>/g, "").trim() });
  }

  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { text, title, metaDescription, headings };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success, resetIn } = aiRateLimiter.check(session.user.id);
    if (!success) {
      return NextResponse.json(
        { error: `KI Rate limit erreicht. Bitte warte ${resetIn} Sekunden.` },
        { status: 429 }
      );
    }

    let { url, title, metaDescription, textContent, keyword, headings } = await request.json();

    // If no textContent provided, fetch the page ourselves
    if (!textContent && url) {
      console.log(`[url-checker/ai-analysis] No textContent provided, fetching ${url}`);
      try {
        let response: Response;
        try {
          response = await proxyFetch(url, { headers: DEFAULT_SCRAPE_HEADERS, timeoutMs: 15000 });
        } catch {
          response = await fetch(url, { headers: DEFAULT_SCRAPE_HEADERS, signal: AbortSignal.timeout(15000), redirect: "follow" });
        }
        if (response.ok) {
          const html = await response.text();
          const extracted = extractTextContent(html);
          textContent = extracted.text;
          if (!title) title = extracted.title;
          if (!metaDescription) metaDescription = extracted.metaDescription;
          if (!headings || headings.length === 0) headings = extracted.headings;
        }
      } catch (fetchErr) {
        console.error(`[url-checker/ai-analysis] Failed to fetch ${url}:`, fetchErr);
      }
    }

    if (!textContent) {
      return NextResponse.json({ error: "Kein Content für KI-Analyse" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const truncatedContent = textContent.slice(0, 4000);
    const headingsList = (headings || []).slice(0, 20).map((h: { level: number; text: string }) => `H${h.level}: ${h.text}`).join('\n');

    const prompt = `Du bist ein SEO-Experte der eine Webseite analysiert. Basierend auf dem Google API Leak (2024) und den dort dokumentierten Systemen (WebRef, NSR, QualityBoost, E-E-A-T Signals) bewerte folgende Seite:

URL: ${url}
Title: ${title || 'Kein Title'}
Meta-Description: ${metaDescription || 'Keine'}
${keyword ? `Fokus-Keyword: ${keyword}` : ''}

Headings:
${headingsList || 'Keine'}

Content (Auszug):
${truncatedContent}

Analysiere und bewerte (jeweils Score 0-100 + kurze Begründung):

1. **E-E-A-T Score**: Experience, Expertise, Authoritativeness, Trustworthiness
2. **Topical Authority**: Wie fokussiert und tiefgehend behandelt die Seite ihr Thema? (Bezug: siteFocusScore, siteRadius)
3. **Entity-Klarheit**: Werden klare Entitäten/Konzepte definiert? (Bezug: WebRef topicalityScore, connectedness)
4. **Content Usefulness**: Löst der Content ein Problem / beantwortet er eine Frage vollständig?
5. **Lesbarkeit & Struktur**: Ist der Content gut strukturiert und leicht konsumierbar?
${keyword ? `6. **Keyword-Integration**: Wird "${keyword}" natürlich und semantisch breit abgedeckt?` : ''}

Antworte im JSON-Format:
{
  "eeat": { "score": number, "analysis": "string" },
  "topicalAuthority": { "score": number, "analysis": "string" },
  "entityClarity": { "score": number, "analysis": "string" },
  "contentUsefulness": { "score": number, "analysis": "string" },
  "readability": { "score": number, "analysis": "string" }${keyword ? `,
  "keywordIntegration": { "score": number, "analysis": "string" }` : ''}
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Keine KI-Antwort erhalten" }, { status: 500 });
    }

    const analysis = JSON.parse(content);

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("[url-checker/ai-analysis] Error:", error);
    return NextResponse.json(
      { error: "Fehler bei der KI-Analyse." },
      { status: 500 }
    );
  }
}
