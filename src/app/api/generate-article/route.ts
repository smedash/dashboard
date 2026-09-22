import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { hasFullAdminRights } from "@/lib/rbac";

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

function buildSystemPrompt(location?: string): string {
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

Pflichtbestandteile:
1. <head> mit title (Format: "[Titel] | UBS"), meta description (140–160 Zeichen, mit Haupt-Keyword), charset, viewport
2. Inline-CSS für sauberes Layout (max-width 800px, UBS Rot #E60000 nur sparsam für Akzente, Überschriften in #1a1a1a / dunklem Grau)
3. <h1> = Artikeltitel
4. Einleitungsabsatz mit class="intro"
5. Navigierbares Inhaltsverzeichnis (<nav class="toc">) mit Anker-Links
6. 5–8 <h2>-Abschnitte mit praxisnahem Inhalt, konkreten Beispielen und klaren Zwischenüberschriften
7. Mindestens eine highlight-box, tip-box oder warning-box
8. Eine CTA-Box (class="cta-box") mit Einladung zur Beratung durch UBS-Expertinnen und -Experten
9. FAQ-Sektion mit 3–5 Fragen und Antworten
10. Kurzes Fazit

Ziel-Länge: 1.200 bis 2.000 Wörter Fliesstext.

CSS-Klassen die du verwenden und im Inline-CSS definieren sollst:
- .intro (Einleitungsabsatz mit farbigem Linksrand)
- .toc (Inhaltsverzeichnis, hellgrauer Hintergrund)
- .highlight-box (heller Hintergrund, für wichtige Hinweise)
- .tip-box (grüner Rand, für Tipps)
- .warning-box (gelber Rand, für Warnungen)
- .example-box (hellgrauer Hintergrund, für Beispiele)
- .cta-box (dunkler Hintergrund, weisser Button)
- .faq-item + .faq-question (für FAQ-Bereich)
- Tabellen mit <th> in dunklem Grau

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

  const userMessage = `Schreibe einen langen, ausführlichen Artikel mit folgenden Parametern:

Titel: ${title}
Funnel-Stage: ${funnelStage}
Kategorie: ${category}
Location / Content-Typ: ${loc}
Zielgruppe: ${targetAudience}
Sprache: ${language || "de"}
${descriptionHint}
${languageInstruction(language)}

Achte besonders auf eine natürliche, fliessende Satzlänge mit durchschnittlich 20 Wörtern pro Satz. Vermeide zu kurze, abgehackte Sätze.

Wichtig: Verwende niemals ß – in der Schweiz gilt ss (Strasse, gross, heiss).

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
      system: buildSystemPrompt(loc),
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
