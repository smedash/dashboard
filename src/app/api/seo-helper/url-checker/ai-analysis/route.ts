import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiRateLimiter } from "@/lib/rate-limit";
import OpenAI from "openai";

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

    const { url, title, metaDescription, textContent, keyword, headings } = await request.json();

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
