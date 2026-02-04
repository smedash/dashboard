import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const { url, content, language = "de" } = await request.json();

    // Either URL or content must be provided
    if (!url && !content) {
      return NextResponse.json(
        { error: "URL oder Content ist erforderlich" },
        { status: 400 }
      );
    }

    // If URL is provided, fetch the content first
    let textContent = content;
    let pageTitle = "";
    let pageUrl = url;

    if (url && !content) {
      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Invalid protocol");
        }
        pageUrl = parsedUrl.href;
      } catch {
        return NextResponse.json(
          { error: "Ungültige URL" },
          { status: 400 }
        );
      }

      // Fetch the URL content
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "de-CH,de-DE;q=0.9,de;q=0.8,en-US;q=0.7,en;q=0.6",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Fehler beim Laden: HTTP ${response.status}` },
          { status: 400 }
        );
      }

      const html = await response.text();
      textContent = extractTextContent(html);
      pageTitle = extractTitle(html);
    }

    // Check if content is too short
    if (!textContent || textContent.length < 100) {
      return NextResponse.json(
        { error: "Der Inhalt ist zu kurz für eine Zusammenfassung" },
        { status: 400 }
      );
    }

    // Truncate content if too long (keep ~12000 chars for API limits)
    const maxContentLength = 12000;
    if (textContent.length > maxContentLength) {
      textContent = textContent.substring(0, maxContentLength) + "...";
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API Key nicht konfiguriert" },
        { status: 500 }
      );
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
          content: `Du bist ein Experte für Content-Analyse und Zusammenfassungen. ${languageInstruction}

Deine Aufgabe ist es, den Inhalt einer Webseite zusammenzufassen und die wichtigsten Informationen herauszuarbeiten.

Erstelle eine strukturierte Zusammenfassung mit:
1. Einer kurzen Executive Summary (2-3 Sätze)
2. Den Hauptthemen/Kernaussagen als Bullet Points
3. Der Zielgruppe (falls erkennbar)
4. Dem Hauptzweck der Seite (informativ, kommerziell, etc.)
5. Möglichen SEO-relevanten Keywords

Formatiere die Ausgabe als JSON mit folgendem Schema:
{
  "executiveSummary": "Kurze Zusammenfassung...",
  "mainTopics": ["Thema 1", "Thema 2", ...],
  "keyTakeaways": ["Kernaussage 1", "Kernaussage 2", ...],
  "targetAudience": "Beschreibung der Zielgruppe",
  "pageIntent": "informational|commercial|transactional|navigational",
  "suggestedKeywords": ["keyword1", "keyword2", ...],
  "contentType": "Artikel|Produktseite|Landingpage|Blog|etc.",
  "readingTime": "Geschätzte Lesezeit in Minuten"
}`
        },
        {
          role: "user",
          content: `Analysiere und fasse den folgenden Webseiteninhalt zusammen:

${pageTitle ? `Seitentitel: ${pageTitle}\n\n` : ""}Inhalt:
${textContent}`
        }
      ],
      temperature: 0.5,
      max_tokens: 2000,
    });

    const responseContent = completion.choices[0]?.message?.content || "{}";
    
    // Parse the JSON response
    let summary;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON object found");
      }
    } catch {
      return NextResponse.json(
        { error: "Fehler beim Verarbeiten der KI-Antwort" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      summary,
      url: pageUrl,
      title: pageTitle,
      contentLength: textContent.length,
    });

  } catch (error) {
    console.error("Error in AI Summarizer:", error);
    return NextResponse.json(
      { error: "Fehler bei der Zusammenfassung. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}

function extractTextContent(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");
  
  // Remove comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  
  // Try to extract main content area
  const mainContentPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  let mainContent = text;
  for (const pattern of mainContentPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length > 200) {
      mainContent = match[1];
      break;
    }
  }

  // Remove header, footer, nav
  mainContent = mainContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");
  mainContent = mainContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  mainContent = mainContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  mainContent = mainContent.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");

  // Convert block elements to newlines
  mainContent = mainContent.replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, "\n");
  mainContent = mainContent.replace(/<(br|hr)[^>]*\/?>/gi, "\n");
  
  // Remove all remaining HTML tags
  mainContent = mainContent.replace(/<[^>]+>/g, " ");
  
  // Decode HTML entities
  mainContent = decodeHtmlEntities(mainContent);
  
  // Clean up whitespace
  mainContent = mainContent.replace(/[ \t]+/g, " ");
  mainContent = mainContent.replace(/\n[ \t]+/g, "\n");
  mainContent = mainContent.replace(/[ \t]+\n/g, "\n");
  mainContent = mainContent.replace(/\n{3,}/g, "\n\n");
  mainContent = mainContent.trim();

  return mainContent;
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    return decodeHtmlEntities(titleMatch[1].trim());
  }
  
  // Try og:title
  const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i) ||
                       html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"[^>]*>/i);
  if (ogTitleMatch) {
    return decodeHtmlEntities(ogTitleMatch[1].trim());
  }

  return "";
}

function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&#39;": "'",
    "&ndash;": "–",
    "&mdash;": "—",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&hellip;": "…",
    "&euro;": "€",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
    "&auml;": "ä",
    "&ouml;": "ö",
    "&uuml;": "ü",
    "&Auml;": "Ä",
    "&Ouml;": "Ö",
    "&Uuml;": "Ü",
    "&szlig;": "ß",
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, "g"), char);
  }

  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => 
    String.fromCharCode(parseInt(code, 10))
  );
  decoded = decoded.replace(/&#x([a-fA-F0-9]+);/g, (_, code) => 
    String.fromCharCode(parseInt(code, 16))
  );

  return decoded;
}
