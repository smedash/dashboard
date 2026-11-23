import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeContentLanguage } from "@/lib/content-workflow";
import { requireUser } from "@/lib/keyword-map/server";
import type { TopicGapItem } from "@/lib/keyword-map/shared";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Legt für ein nicht abgedecktes Topic einen Artikel im Redaktionsplan an
 * (Body: `{ gapId, index, plannedDate }`, `index` = Position in `results`, `plannedDate` = YYYY-MM-DD).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { gapId?: unknown; index?: unknown; plannedDate?: unknown };
    if (typeof body.gapId !== "string" || !Number.isInteger(body.index) || (body.index as number) < 0) {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }
    const gapId = body.gapId;
    const index = body.index as number;
    const plannedDate =
      typeof body.plannedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.plannedDate)
        ? new Date(body.plannedDate)
        : new Date(new Date().toISOString().slice(0, 10));

    const article = await prisma.$transaction(async (tx) => {
      // Zeilensperre, damit Doppelklicks keinen zweiten Artikel anlegen
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "KeywordMapTopicGap" WHERE "id" = ${gapId} AND "urlId" = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new HttpError(404, "Analyse nicht gefunden");

      const gap = await tx.keywordMapTopicGap.findUniqueOrThrow({
        where: { id: gapId },
        include: { url: { include: { project: true } } },
      });
      const items = Array.isArray(gap.results) ? (gap.results as unknown as TopicGapItem[]) : [];
      const item = items[index];
      if (gap.status !== "succeeded" || !item) throw new HttpError(404, "Topic nicht gefunden");
      if (item.status === "covered") throw new HttpError(400, "Topic ist bereits abgedeckt");

      if (item.editorialArticleId) {
        const existing = await tx.editorialPlanArticle.findUnique({ where: { id: item.editorialArticleId }, select: { id: true } });
        if (existing) throw new HttpError(409, "Für dieses Topic gibt es bereits einen Artikel im Redaktionsplan");
      }

      const description = [
        `Topic-Gap aus dem Keyword Mapping (${item.status === "missing" ? "fehlt" : "teilweise abgedeckt"})`,
        `URL: ${gap.url.url}`,
        `Fokus-Keyword: ${gap.focusKeyword}`,
        item.path.length ? `Topic-Pfad: ${[...item.path, item.topic].join(" > ")}` : null,
        item.reason ? `Begründung: ${item.reason}` : null,
        item.otherUrls?.length ? `Bereits abgedeckt auf: ${item.otherUrls.map((u) => u.url).join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const created = await tx.editorialPlanArticle.create({
        data: {
          title: item.topic,
          description,
          language: normalizeContentLanguage(gap.url.project.languageCode),
          category: gap.url.project.category || null,
          status: "planned",
          plannedDate,
          creatorId: user.id,
        },
        select: { id: true, title: true, plannedDate: true },
      });

      const next = items.map((it, i) => (i === index ? { ...it, editorialArticleId: created.id } : it));
      await tx.keywordMapTopicGap.update({
        where: { id: gapId },
        data: { results: next as unknown as Prisma.InputJsonValue },
      });
      return created;
    });

    return NextResponse.json({ article: { id: article.id, title: article.title, plannedDate: article.plannedDate?.toISOString() ?? null } });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[keyword-mapping/topic-gap/editorial] POST", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Artikel konnte nicht angelegt werden" }, { status: 500 });
  }
}
