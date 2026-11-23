import type { Prisma } from "@prisma/client";
import type { TopicGapItem, TopicOtherUrl } from "./shared";
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

async function lockSucceededGap(tx: Prisma.TransactionClient, gapId: string, urlId: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "KeywordMapTopicGap" WHERE "id" = ${gapId} AND "urlId" = ${urlId} FOR UPDATE
  `;
  if (locked.length === 0) throw new TopicGapTaskError(404, "Analyse nicht gefunden");

  const gap = await tx.keywordMapTopicGap.findUniqueOrThrow({
    where: { id: gapId },
    include: { url: { include: { project: true } } },
  });
  if (gap.status !== "succeeded") throw new TopicGapTaskError(400, "Analyse ist noch nicht abgeschlossen");
  return gap;
}

async function nextBacklogOrder(tx: Prisma.TransactionClient): Promise<number> {
  const maxOrder = await tx.task.findFirst({ where: { status: "backlog" }, orderBy: { order: "desc" }, select: { order: true } });
  return (maxOrder?.order ?? -1) + 1;
}

function taskCategory(category: string | null): string | null {
  return category && TASK_CATEGORIES.includes(category) ? category : null;
}

function linkStatusText(u: TopicOtherUrl): string | null {
  if (u.link === undefined) return null;
  if (u.link === null) return "Querverweis fehlt";
  const anchor = u.link.anchor ? ` (Ankertext „${u.link.anchor}“)` : "";
  return u.link.inContent ? `Bereits im Content verlinkt${anchor}` : `Nur in Navigation/Header/Footer verlinkt${anchor}`;
}

function linkTaskDescription(pageUrl: string, focusKeyword: string, item: TopicGapItem, links: TopicOtherUrl[]): string {
  const lines = [
    `Seite: ${pageUrl}`,
    `Fokus-Keyword: ${focusKeyword}`,
    `Topic: ${[...item.path, item.topic].join(" > ")} (${item.status === "missing" ? "fehlt" : "teilweise abgedeckt"})`,
    "",
    `Linkempfehlungen (${links.length}) – interne Links von der Seite auf diese URLs setzen:`,
  ];
  for (const u of links) {
    lines.push(`- ${u.url}${u.title ? ` – ${u.title}` : ""}`);
    if (u.heading) lines.push(`  Abschnitt: „${u.heading}“`);
    const status = linkStatusText(u);
    if (status) lines.push(`  Status: ${status}`);
  }
  return lines.join("\n");
}

/**
 * Legt aus einer Gap-Analyse einen Task im Backlog des Kanban-Boards an und verknüpft ihn mit der Analyse.
 * Muss innerhalb einer Transaktion laufen; die Zeilensperre verhindert doppelte Tasks bei parallelen Anfragen.
 */
export async function createTopicGapTask(tx: Prisma.TransactionClient, gapId: string, urlId: string, userId: string) {
  const gap = await lockSucceededGap(tx, gapId, urlId);

  if (gap.taskId) {
    const existing = await tx.task.findUnique({ where: { id: gap.taskId }, select: { id: true } });
    if (existing) throw new TopicGapTaskError(409, "Für diese Analyse gibt es bereits einen Task");
  }

  const items = Array.isArray(gap.results) ? (gap.results as unknown as TopicGapItem[]) : [];

  const created = await tx.task.create({
    data: {
      title: `Content-Gaps schliessen: ${gap.url.h1 || gap.url.url}`,
      description: taskDescription(gap.focusKeyword, gap.coverageScore, gap.summary, items),
      url: safeTaskUrl(gap.url.url),
      status: "backlog",
      priority: "medium",
      scope: "content",
      order: await nextBacklogOrder(tx),
      category: taskCategory(gap.url.project.category),
      labels: ["Topic-Gap"],
      creatorId: userId,
    },
    select: { id: true },
  });
  await tx.keywordMapTopicGap.update({ where: { id: gapId }, data: { taskId: created.id } });
  return created;
}

/**
 * Legt für ein Topic einen Linking-Task mit den ausgewählten Linkempfehlungen (`otherUrls`) im Backlog an
 * und vermerkt die Task-ID an den übernommenen Empfehlungen. Muss innerhalb einer Transaktion laufen.
 */
export async function createTopicGapLinkTask(
  tx: Prisma.TransactionClient,
  params: { gapId: string; urlId: string; index: number; inventoryIds: string[]; userId: string }
) {
  const gap = await lockSucceededGap(tx, params.gapId, params.urlId);
  const items = Array.isArray(gap.results) ? (gap.results as unknown as TopicGapItem[]) : [];
  const item = items[params.index];
  if (!item?.otherUrls?.length) throw new TopicGapTaskError(404, "Topic nicht gefunden");

  const wanted = new Set(params.inventoryIds);
  const links = item.otherUrls.filter((u) => wanted.has(u.inventoryId));
  if (links.length === 0) throw new TopicGapTaskError(400, "Keine Linkempfehlung ausgewählt");

  const linkedTaskIds = [...new Set(links.flatMap((u) => (u.taskId ? [u.taskId] : [])))];
  if (linkedTaskIds.length) {
    const existing = await tx.task.count({ where: { id: { in: linkedTaskIds } } });
    if (existing > 0) throw new TopicGapTaskError(409, "Mindestens eine der Linkempfehlungen steht bereits in einem Task");
  }

  const created = await tx.task.create({
    data: {
      title: `Interne Links setzen: ${item.topic} – ${gap.url.h1 || gap.url.url}`,
      description: linkTaskDescription(gap.url.url, gap.focusKeyword, item, links),
      url: safeTaskUrl(gap.url.url),
      status: "backlog",
      priority: "medium",
      scope: "linking",
      order: await nextBacklogOrder(tx),
      category: taskCategory(gap.url.project.category),
      labels: ["Topic-Gap", "Linkempfehlung"],
      creatorId: params.userId,
    },
    select: { id: true },
  });

  const next = items.map((it, i) =>
    i === params.index && it.otherUrls
      ? { ...it, otherUrls: it.otherUrls.map((u) => (wanted.has(u.inventoryId) ? { ...u, taskId: created.id } : u)) }
      : it
  );
  await tx.keywordMapTopicGap.update({ where: { id: params.gapId }, data: { results: next as unknown as Prisma.InputJsonValue } });
  return { task: created, otherUrls: next[params.index].otherUrls! };
}
