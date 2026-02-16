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

    const { success, remaining, resetIn } = aiRateLimiter.check(session.user.id);
    if (!success) {
      return NextResponse.json(
        { error: `Rate limit erreicht. Bitte warte ${resetIn} Sekunden.` },
        { status: 429, headers: { "Retry-After": String(resetIn), "X-RateLimit-Remaining": "0" } }
      );
    }

    const { keyword, language = "de", count = 10 } = await request.json();

    if (!keyword || typeof keyword !== "string") {
      return NextResponse.json(
        { error: "Keyword ist erforderlich" },
        { status: 400 }
      );
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      // Fallback: Generate pattern-based FAQs
      const faqs = generatePatternBasedFAQs(keyword, count);
      return NextResponse.json({ faqs, source: "pattern" });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const languageInstruction = language === "de" 
      ? "Antworte auf Deutsch." 
      : "Answer in English.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Du bist ein SEO-Experte, der häufig gestellte Fragen (FAQs) für Websites erstellt. ${languageInstruction}
          
Erstelle Fragen, die:
- Echte Nutzerintentionen widerspiegeln
- Verschiedene Suchintentionen abdecken (informational, transactional, navigational)
- Unterschiedliche W-Fragen verwenden (Was, Wie, Warum, Wann, Wo, Welche, Wer)
- Longtail-Keywords enthalten
- Für Featured Snippets optimiert sind`
        },
        {
          role: "user",
          content: `Erstelle ${count} häufig gestellte Fragen (FAQs) zum Thema "${keyword}".

Gib die Antwort als JSON-Array zurück mit folgendem Format:
[
  {
    "question": "Die Frage",
    "searchIntent": "informational|transactional|navigational",
    "questionType": "was|wie|warum|wann|wo|welche|wer|kann|ist|soll"
  }
]

Nur das JSON-Array, keine zusätzlichen Erklärungen.`
        }
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content || "[]";
    
    // Parse the JSON response
    let faqs;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        faqs = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON array found");
      }
    } catch {
      // If parsing fails, use fallback
      const fallbackFaqs = generatePatternBasedFAQs(keyword, count);
      return NextResponse.json({ faqs: fallbackFaqs, source: "pattern" });
    }

    return NextResponse.json({ faqs, source: "ai" });

  } catch (error) {
    console.error("Error generating FAQs:", error);
    
    // Return pattern-based FAQs as fallback
    try {
      const { keyword, count = 10 } = await request.json();
      const faqs = generatePatternBasedFAQs(keyword || "Thema", count);
      return NextResponse.json({ faqs, source: "pattern" });
    } catch {
      return NextResponse.json(
        { error: "Fehler bei der FAQ-Generierung" },
        { status: 500 }
      );
    }
  }
}

function generatePatternBasedFAQs(keyword: string, count: number): Array<{
  question: string;
  searchIntent: string;
  questionType: string;
}> {
  const patterns = [
    { template: `Was ist ${keyword}?`, intent: "informational", type: "was" },
    { template: `Wie funktioniert ${keyword}?`, intent: "informational", type: "wie" },
    { template: `Was kostet ${keyword}?`, intent: "transactional", type: "was" },
    { template: `Wo kann man ${keyword} kaufen?`, intent: "transactional", type: "wo" },
    { template: `Welche Vorteile hat ${keyword}?`, intent: "informational", type: "welche" },
    { template: `Warum ist ${keyword} wichtig?`, intent: "informational", type: "warum" },
    { template: `Wann sollte man ${keyword} nutzen?`, intent: "informational", type: "wann" },
    { template: `Wie lange dauert ${keyword}?`, intent: "informational", type: "wie" },
    { template: `Welche Arten von ${keyword} gibt es?`, intent: "informational", type: "welche" },
    { template: `Ist ${keyword} sicher?`, intent: "informational", type: "ist" },
    { template: `Kann man ${keyword} selbst machen?`, intent: "informational", type: "kann" },
    { template: `Was sind die Nachteile von ${keyword}?`, intent: "informational", type: "was" },
    { template: `Wer bietet ${keyword} an?`, intent: "navigational", type: "wer" },
    { template: `Wie viel ${keyword} braucht man?`, intent: "informational", type: "wie" },
    { template: `Was muss man bei ${keyword} beachten?`, intent: "informational", type: "was" },
    { template: `Welche Alternativen gibt es zu ${keyword}?`, intent: "informational", type: "welche" },
    { template: `Wie vergleicht man ${keyword}?`, intent: "informational", type: "wie" },
    { template: `Wann lohnt sich ${keyword}?`, intent: "transactional", type: "wann" },
    { template: `Wo findet man Informationen zu ${keyword}?`, intent: "navigational", type: "wo" },
    { template: `Soll man ${keyword} wählen?`, intent: "transactional", type: "soll" },
  ];

  // Shuffle and take the requested count
  const shuffled = patterns.sort(() => Math.random() - 0.5);
  
  return shuffled.slice(0, Math.min(count, patterns.length)).map(p => ({
    question: p.template,
    searchIntent: p.intent,
    questionType: p.type,
  }));
}
