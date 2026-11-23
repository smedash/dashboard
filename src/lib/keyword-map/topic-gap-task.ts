import type { Prisma } from "@prisma/client";
import type { TopicGapItem } from "./shared";
import { normalizeTaskUrl } from "@/lib/task-url";

const TASK_CATEGORIES = ["Mortgages", "Accounts&Cards", "Investing", "Pension", "Digital Banking"];

export class TopicGapTaskError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function taskDescription(focusKeyword: string, coverage: number | null, summary: string | null, items: TopicGapItem[]): string {
  const topicLine = (i: TopicGapItem) => `- ${[...i.path, i.topic].join(" > ")}`;
  const missing = items.filter((i) => i.status === "missing");
  const partial = items.filter((i) => i.status === "partial");
  const lines = [`Fokus-Keyword: ${focusKeyword}`, `Topic-Coverage: ${coverage ?? "–"} %`];
  if (summary) lines.push("", summary);
  if (missing.length) lines.push("", `Fehlende Topics (${missing.length}):`, ...missing.map(topicLine));
  if (partial.length) lines.push("", `Teilweise abgedeckt (${partial.length}):`, ...partial.map(topicLine));
  return lines.join("\n");
}

function safeTaskUrl(url: string): string | null {
  try {
    return normalizeTaskUrl(url);
  } catch {
    return null;
  }
}

/**
 * Legt aus einer Gap-Analyse einen Task im Backlog des Kanban-Boards an und verknüpft ihn mit der Analyse.
 * Muss innerhalb einer Transaktion laufen; die Zeilensperre verhindert doppelte Tasks bei parallelen Anfragen.
 */
export async function createTopicGapTask(tx: Prisma.TransactionClient, gapId: string, urlId: string, userId: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "KeywordMapTopicGap" WHERE "id" = ${gapId} AND "urlId" = ${urlId} FOR UPDATE
  `;
  if (locked.length === 0) throw new TopicGapTaskError(404, "Analyse nicht gefunden");

  const gap = await tx.keywordMapTopicGap.findUniqueOrThrow({
    where: { id: gapId },
    include: { url: { include: { project: true } } },
  });
  if (gap.status !== "succeeded") throw new TopicGapTaskError(400, "Analyse ist noch nicht abgeschlossen");

  if (gap.taskId) {
    const existing = await tx.task.findUnique({ where: { id: gap.taskId }, select: { id: true } });
    if (existing) throw new TopicGapTaskError(409, "Für diese Analyse gibt es bereits einen Task");
  }

  const items = Array.isArray(gap.results) ? (gap.results as unknown as TopicGapItem[]) : [];
  const category = gap.url.project.category && TASK_CATEGORIES.includes(gap.url.project.category) ? gap.url.project.category : null;
  const maxOrder = await tx.task.findFirst({ where: { status: "backlog" }, orderBy: { order: "desc" }, select: { order: true } });

  const created = await tx.task.create({
    data: {
      title: `Content-Gaps schliessen: ${gap.url.h1 || gap.url.url}`,
      description: taskDescription(gap.focusKeyword, gap.coverageScore, gap.summary, items),
      url: safeTaskUrl(gap.url.url),
      status: "backlog",
      priority: "medium",
      scope: "content",
      order: (maxOrder?.order ?? -1) + 1,
      category,
      labels: ["Topic-Gap"],
      creatorId: userId,
    },
    select: { id: true },
  });
  await tx.keywordMapTopicGap.update({ where: { id: gapId }, data: { taskId: created.id } });
  return created;
}
