import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { hasFullAdminRights } from "@/lib/rbac";
import { formatArticleHeroDate } from "@/lib/article-html";
import { buildArticleSystemPrompt, buildArticleUserMessage } from "@/lib/content-master-prompt";
import { normalizeContentLanguage } from "@/lib/content-workflow";

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

  const loc = location || "Guide";
  const lang = normalizeContentLanguage(language);
  const heroDate = formatArticleHeroDate(lang);

  const userMessage = buildArticleUserMessage({
    title,
    funnelStage,
    category,
    targetAudience,
    location: loc,
    language: lang,
    description,
    heroDate,
  });

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
      system: buildArticleSystemPrompt(loc, { category, heroDate, language: lang }),
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
                const raw = String(event.delta.text);
                const text = lang === "de" ? raw.replace(/ß/g, "ss") : raw;
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
