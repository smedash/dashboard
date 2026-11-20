import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/keyword-map/server";
import type { TopicGapItem } from "@/lib/keyword-map/shared";

const TASK_CATEGORIES = ["Mortgages", "Accounts&Cards", "Investing", "Pension", "Digital Banking"];

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function taskDescription(url: string, focusKeyword: string, coverage: number | null, summary: string | null, items: TopicGapItem[]): string {
  const topicLine = (i: TopicGapItem) => `- ${[...i.path, i.topic].join(" > ")}`;
  const missing = items.filter((i) => i.status === "missing");
  const partial = items.filter((i) => i.status === "partial");
  const lines = [`URL: ${url}`, `Fokus-Keyword: ${focusKeyword}`, `Topic-Coverage: ${coverage ?? "–"} %`];
  if (summary) lines.push("", summary);
  if (missing.length) lines.push("", `Fehlende Topics (${missing.length}):`, ...missing.map(topicLine));
  if (partial.length) lines.push("", `Teilweise abgedeckt (${partial.length}):`, ...partial.map(topicLine));
  return lines.join("\n");
}

/** Legt aus einer Gap-Analyse einen Task im Kanban-Board (Backlog) an (Body: `{ gapId }`). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { gapId?: unknown };
    if (typeof body.gapId !== "string") return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    const gapId = body.gapId;

    const task = await prisma.$transaction(async (tx) => {
      // Zeilensperre, damit Doppelklicks keinen zweiten Task anlegen
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "KeywordMapTopicGap" WHERE "id" = ${gapId} AND "urlId" = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new HttpError(404, "Analyse nicht gefunden");

      const gap = await tx.keywordMapTopicGap.findUniqueOrThrow({
        where: { id: gapId },
        include: { url: { include: { project: true } } },
      });
      if (gap.status !== "succeeded") throw new HttpError(400, "Analyse ist noch nicht abgeschlossen");

      if (gap.taskId) {
        const existing = await tx.task.findUnique({ where: { id: gap.taskId }, select: { id: true } });
        if (existing) throw new HttpError(409, "Für diese Analyse gibt es bereits einen Task");
      }

      const items = Array.isArray(gap.results) ? (gap.results as unknown as TopicGapItem[]) : [];
      const category = gap.url.project.category && TASK_CATEGORIES.includes(gap.url.project.category) ? gap.url.project.category : null;
      const maxOrder = await tx.task.findFirst({ where: { status: "backlog" }, orderBy: { order: "desc" }, select: { order: true } });

      const created = await tx.task.create({
        data: {
          title: `Content-Gaps schliessen: ${gap.url.h1 || gap.url.url}`,
          description: taskDescription(gap.url.url, gap.focusKeyword, gap.coverageScore, gap.summary, items),
          status: "backlog",
          priority: "medium",
          order: (maxOrder?.order ?? -1) + 1,
          category,
          labels: ["Topic-Gap"],
          creatorId: user.id,
        },
        select: { id: true },
      });
      await tx.keywordMapTopicGap.update({ where: { id: gapId }, data: { taskId: created.id } });
      return created;
    });

    return NextResponse.json({ task });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[keyword-mapping/topic-gap/task] POST", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Task konnte nicht angelegt werden" }, { status: 500 });
  }
}
