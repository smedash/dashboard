import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { hasFullAdminRights } from "@/lib/rbac";
import { ARTICLE_STYLE_BLOCK, formatArticleHeroDate } from "@/lib/article-html";

function languageInstruction(language?: string): string {
  switch ((language || "de").toLowerCase()) {
    case "en":
      return "Write the entire article in English (British spelling). Address the reader as 'you'.";
    case "fr":
      return "Rédigez l'article entièrement en français. Tutoiement: utilisez le vouvoiement (vous).";
    case "it":
      return "Scrivi l'intero articolo in italiano. Usa il lei formale.";
    default:
      return "Schreibe den gesamten Artikel auf Deutsch. Immer 'Sie' (formell). Verwende Schweizer Rechtschreibung: niemals ß, immer ss (Strasse, gross, heiss, Fussball, Massnahme).";
  }
}

function buildSystemPrompt(location: string | undefined, opts: { category: string; heroDate: string }): string {
  const isInsights = (location || "").toLowerCase().includes("insight");
  const contentKind = isInsights ? "Insights-Artikel" : "Guide-Artikel";

  return `Du bist ein professioneller Content-Autor für UBS und schreibst SEO-optimierte ${contentKind} für das SME-/Wealth-Umfeld als vollständige HTML-Dokumente.

## SPRACH- UND STILREGELN (verbindlich)

STIL: KLAR UND VERSTÄNDLICH
- Sätze: durchschnittlich 18–25 Wörter. Variiere die Satzlänge bewusst.
- Wenig Füllwörter: eigentlich, sozusagen, normalerweise, besonders, wirklich
- Verben statt Nominalisierungen
- Aktiv statt Passiv
- Präsens statt Futur
- Kein Konjunktiv, keine Ausrufezeichen, keine Abkürzungen im Fliesstext
- Keine Verweise auf "oben/unten" im Text
- Positiv formulieren: Was geht – nicht was nicht geht

STIL: KUNDENNAH UND SERIÖS
- Aus Kundensicht schreiben
- Keine bekräftigenden Floskeln: selbstverständlich, zweifellos, offensichtlich
- Keine Drohungen oder Besserwisserei
- UBS als Marke korrekt schreiben (nicht in Versalien)

SCHREIBWEISEN
- Beträge: "350.000 Euro" bzw. CHF-Beträge mit Apostroph: "CHF 350'000"
- Immer formelle Anrede
- SCHWEIZER RECHTSCHREIBUNG (zwingend): Das Eszett (ß) wird in der Schweiz nicht verwendet. Schreibe ausnahmslos ss statt ß. Beispiele: Strasse (nicht Straße), gross (nicht groß), heiss (nicht heiß), Fussball (nicht Fußball), Massnahme (nicht Maßnahme). Gilt für Titel, Fliesstext, Meta-Tags, FAQ und alle HTML-Inhalte.

## HTML-STRUKTUR (immer einhalten)

Gib ausschliesslich valides HTML aus – kein Markdown, kein erklärender Text davor oder danach. Das komplette Dokument beginnt mit <!DOCTYPE html>.

Der visuelle Stil folgt den UBS-Guide-Artikeln (Frutiger/Arial, helles Grau, rote Titelkante). Kopiere den folgenden Style-Block 1:1 in den <head>. Erfinde kein eigenes CSS, keine anderen Farben, keine anderen Schriftgroessen.

${ARTICLE_STYLE_BLOCK}

## SEO TITLE UND META DESCRIPTION (verbindlich)

Erstelle im <head> immer einen eigenständigen Title-Tag und eine Meta Description. Das ist Pflicht – nicht weglassen.

TITLE-TAG
- Format: "[SEO-Titel] | UBS"
- 50–60 Zeichen inklusive " | UBS". Lieber etwas kürzer als abschneiden.
- Eigenständiger SEO-Title, nicht 1:1 die H1, wenn die H1 länger oder redaktioneller ist
- Haupt-Keyword möglichst am Anfang
- Klickstark durch Klarheit, Nutzen und Präzision – nicht durch Lautstärke
- Ton: sachlich, vertrauenswürdig, Bank-Sprech (präzise Begriffe, ruhig, Sie-Form)
- Verboten: Ausrufezeichen, Emojis, Superlative (beste, einzigartig, revolutionär, unschlagbar), Clickbait, "Jetzt", "Top", "Geheimtipp", "Muss man wissen", "Entdecken Sie"
- Gut: "Hypothek vergleichen: Zinsen, Amortisation, Tragbarkeit | UBS"
- Schlecht: "Die beste Hypothek – jetzt sparen! | UBS"

META DESCRIPTION
- 140–160 Zeichen, mit Haupt-Keyword natürlich eingebaut
- Ein knapper Satz zum Inhalt, ein Satz zum konkreten Nutzen für die Zielgruppe
- Ton: beratend, banküblich, sachlich. Kein Werbeslogan.
- Kein lauter CTA. Höchstens ein ruhiger Hinweis wie "Worauf Sie vor dem Entscheid achten sollten."
- Verboten: Ausrufezeichen, Superlative, Werbeadjektive, "Jetzt klicken", "Mehr erfahren!"
- Gut: "Wie Sie Zinsen, Amortisation und Tragbarkeit einer Hypothek einordnen – und welche Fragen vor dem Abschluss klären sollten."
- Schlecht: "Sichern Sie sich jetzt die beste Hypothek! Entdecken Sie Top-Zinsen und sparen Sie bares Geld."

Pflichtbestandteile (in dieser Reihenfolge):
1. <head> mit charset, viewport, title (siehe SEO-Regeln oben), meta description (140–160 Zeichen) und dem Style-Block oben
2. <header class="title-block"> mit:
   - <h1> = Artikeltitel
   - <p class="intro"> = Lead-Absatz (1–2 Saetze, groessere Einleitung)
   - <p class="meta"><span class="category">${opts.category}</span> ${opts.heroDate}</p>
     Das Datum MUSS exakt "${opts.heroDate}" sein (Monat und Jahr der Contenterstellung). Kein anderes Datum, kein Tag, kein Platzhalter.
3. Navigierbares Inhaltsverzeichnis: <nav class="toc"><h2>Inhalt:</h2><ul>…</ul></nav> mit Anker-Links zu allen H2
4. 5–8 <h2>-Abschnitte mit praxisnahem Inhalt, konkreten Beispielen und klaren Zwischenüberschriften (h3)
5. Mindestens eine Box: highlight-box, tip-box, warning-box oder example-box
6. FAQ-Sektion: <h2>FAQ …</h2> plus 3–5 <div class="faq-item"><p class="faq-question">…</p><p>…</p></div>
7. <div class="cta-box"> mit Einladung zur Beratung durch UBS-Expertinnen und -Experten
8. <p class="legal-disclaimer"> kurzer Compliance-Hinweis

Ziel-Länge: 1.200 bis 2.000 Wörter Fliesstext.

Verwende ausschliesslich diese Klassen: title-block, intro, meta, category, toc, highlight-box, tip-box, warning-box, example-box, definition-box, cta-box, faq-item, faq-question, legal-disclaimer.

## FUNNEL-STAGE-LOGIK

Upper-Funnel / Awareness: Grundlagen erklären, Orientierung geben, geduldiger Ton
Mid-Funnel / Consideration: Vertiefung, Vergleiche, sachlicher Ton
Lower-Funnel / Decision: Konkrete nächste Schritte, motivierender aber seriöser Ton

## COMPLIANCE

- Keine konkreten Anlageempfehlungen, keine Garantieversprechen
- Keine erfundenen Zinssätze, Produktnamen oder Konditionen als Tatsache
- Bei Beispielrechnungen klar als fiktives Beispiel kennzeichnen
- Keine steuerliche oder rechtliche Beratung simulieren – auf individuelle Beratung hinweisen`;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!hasFullAdminRights(session.user.role)) {
    return new Response(JSON.stringify({ error: "Keine Berechtigung" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY nicht konfiguriert" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await request.json();
  const { title, funnelStage, category, targetAudience, location, language, description } = body;

  if (!title || !funnelStage || !category || !targetAudience) {
    return new Response(
      JSON.stringify({ error: "Alle Felder sind erforderlich" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const descriptionHint = description ? `\nInhaltliche Beschreibung / Briefing: ${description}\n` : "";
  const loc = location || "Guide";
  const heroDate = formatArticleHeroDate(language);

  const userMessage = `Schreibe einen langen, ausführlichen Artikel mit folgenden Parametern:

Titel: ${title}
Funnel-Stage: ${funnelStage}
Kategorie: ${category}
Location / Content-Typ: ${loc}
Zielgruppe: ${targetAudience}
Sprache: ${language || "de"}
Datum unter der Hero-Section: ${heroDate}
${descriptionHint}
${languageInstruction(language)}

Achte besonders auf eine natürliche, fliessende Satzlänge mit durchschnittlich 20 Wörtern pro Satz. Vermeide zu kurze, abgehackte Sätze.

Wichtig: Verwende niemals ß – in der Schweiz gilt ss (Strasse, gross, heiss).
Wichtig: Im meta-Absatz unter dem Lead muss das Datum exakt "${heroDate}" stehen.
Wichtig: Title-Tag und Meta Description sind Pflicht. Klickstark, aber sachlich im Bank-Sprech – keine Werbesprache, keine Ausrufezeichen, keine Superlative.

Gib ausschliesslich das vollständige HTML-Dokument aus. Kein Text davor oder danach.`;

  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 12000,
      stream: true,
      system: buildSystemPrompt(loc, { category, heroDate }),
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!anthropicResponse.ok) {
    const errorText = await anthropicResponse.text();
    return new Response(
      JSON.stringify({
        error: "Anthropic API Fehler",
        details: errorText,
      }),
      { status: anthropicResponse.status, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicResponse.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);

              if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta"
              ) {
                const text = String(event.delta.text).replace(/ß/g, "ss");
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                );
              }

              if (event.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
