import type { Prisma } from "@prisma/client";
import type { TopicGapItem, TopicOtherUrl } from "./shared";
import { normalizeTaskUrl } from "@/lib/task-url";

const TASK_CATEGORIES = ["Mortgages", "Accounts&Cards", "Investing", "Pension", "Digital Banking"];

export class TopicGapTaskError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const MAX_LINK_TARGETS = 10;
const MAX_TOPICS_PER_TARGET = 6;
const EDITORIAL_MARK = " (Redaktionsplan)";

const topicPath = (i: TopicGapItem) => [...i.path, i.topic].join(" > ");
const coveringUrls = (i: TopicGapItem) => (i.otherUrls ?? []).filter((u) => u.status === "covered");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type TopicNode = { marked: boolean; children: Map<string, TopicNode> };

const topicNode = (): TopicNode => ({ marked: false, children: new Map() });

function formatNodes(nodes: Map<string, TopicNode>): string {
  return [...nodes]
    .map(([name, node]) => `${name}${node.marked ? EDITORIAL_MARK : ""}${node.children.size ? ` (${formatNodes(node.children)})` : ""}`)
    .join(", ");
}

/** Fasst fehlende Topics je Hauptthema zu einer Zeile zusammen: „- Historie: Zeitreihen (Tagesverlauf, Jahresverlauf), Archivdaten“. */
function missingLines(items: TopicGapItem[]): string[] {
  const roots = new Map<string, TopicNode>();
  for (const i of items) {
    let level = roots;
    let node: TopicNode | undefined;
    for (const name of [...i.path, i.topic]) {
      node = level.get(name) ?? topicNode();
      level.set(name, node);
      level = node.children;
    }
    if (node && i.editorialArticleId) node.marked = true;
  }
  return [...roots].map(
    ([root, node]) => `- ${root}${node.marked ? EDITORIAL_MARK : ""}${node.children.size ? `: ${formatNodes(node.children)}` : ""}`
  );
}

function partialLine(i: TopicGapItem): string {
  const reason = i.reason ? ` – ${i.reason}` : "";
  const evidence = i.evidence ? ` (Fundstelle: „${i.evidence}“)` : "";
  return `- ${topicPath(i)}${i.editorialArticleId ? EDITORIAL_MARK : ""}${reason}${evidence}`;
}

type LinkTarget = { url: TopicOtherUrl; topics: string[]; inTask: boolean };

/** Gruppiert die abdeckenden URLs, damit jedes Linkziel nur einmal mit all seinen Topics auftaucht. */
function linkTargets(items: TopicGapItem[], liveTaskIds: Set<string>): LinkTarget[] {
  const byId = new Map<string, LinkTarget>();
  for (const i of items) {
    for (const u of coveringUrls(i)) {
      const target = byId.get(u.inventoryId) ?? { url: u, topics: [], inTask: false };
      target.topics.push(i.topic);
      if (u.taskId && liveTaskIds.has(u.taskId)) target.inTask = true;
      byId.set(u.inventoryId, target);
    }
  }
  return [...byId.values()].sort((a, b) => b.topics.length - a.topics.length);
}

function linkTargetLines({ url, topics, inTask }: LinkTarget): string[] {
  const status = url.link === null ? "Querverweis fehlt" : url.link && !url.link.inContent ? "nur in Navigation/Header/Footer verlinkt" : null;
  const notes = [status, inTask ? "steht bereits in einem Linking-Task" : null].filter(Boolean);
  const shown = topics.slice(0, MAX_TOPICS_PER_TARGET).join(", ");
  const more = topics.length > MAX_TOPICS_PER_TARGET ? ` (+${topics.length - MAX_TOPICS_PER_TARGET})` : "";
  return [`- ${url.url}${notes.length ? ` – ${notes.join(", ")}` : ""}`, `  Deckt ab: ${shown}${more}`];
}

function taskDescription(
  pageUrl: string,
  focusKeyword: string,
  coverage: number | null,
  summary: string | null,
  items: TopicGapItem[],
  liveTaskIds: Set<string>
): string {
  const open = items.filter((i) => i.status !== "covered");
  const linkInstead = open.filter((i) => coveringUrls(i).length > 0);
  const missing = open.filter((i) => i.status === "missing" && !linkInstead.includes(i));
  const partial = open.filter((i) => i.status === "partial" && !linkInstead.includes(i));

  const lines = [
    coverage == null
      ? `Ziel: Offene Topics zu „${focusKeyword}“ schliessen, damit die Seite das Thema vollständig beantwortet.`
      : `Ziel: Die Seite deckt ${coverage} % der relevanten Topics zu „${focusKeyword}“ ab. Offene Topics ergänzen bzw. verlinken, damit sie das Thema vollständig beantwortet.`,
    "",
    `Seite: ${pageUrl}`,
    `Fokus-Keyword: ${focusKeyword} · Topic-Coverage: ${coverage ?? "–"} %`,
  ];
  if (summary) lines.push("", "Einschätzung:", summary);

  if (open.length === 0) {
    lines.push("", "Keine offenen Topics – die Seite deckt alle Topics ab.");
    return lines.join("\n");
  }

  let step = 0;
  if (missing.length) {
    lines.push(
      "",
      `${++step}. Neue Inhalte ergänzen (${plural(missing.length, "Topic", "Topics")})`,
      "Diese Topics fehlen auf der Seite. Je Hauptthema einen Abschnitt ergänzen und die Unterpunkte darin behandeln; Reihenfolge nach Relevanz für die Suchintention.",
      ...missingLines(missing)
    );
  }
  if (partial.length) {
    lines.push(
      "",
      `${++step}. Bestehende Abschnitte ausbauen (${plural(partial.length, "Topic", "Topics")})`,
      "Diese Topics werden nur angerissen. Den vorhandenen Abschnitt an der Fundstelle vertiefen, statt einen neuen anzulegen.",
      ...partial.map(partialLine)
    );
  }
  if (linkInstead.length) {
    const targets = linkTargets(linkInstead, liveTaskIds);
    const todo = targets.filter((t) => !t.url.link?.inContent);
    const done = targets.length - todo.length;
    lines.push(
      "",
      `${++step}. Intern verlinken statt doppelt schreiben (${plural(linkInstead.length, "Topic", "Topics")})`,
      "Diese Topics behandeln andere Seiten bereits ausführlich. Hier nur kurz einordnen (1–2 Sätze) und im Fliesstext mit sprechendem Ankertext auf die passende Seite verlinken."
    );
    for (const t of todo.slice(0, MAX_LINK_TARGETS)) lines.push(...linkTargetLines(t));
    if (todo.length > MAX_LINK_TARGETS) {
      lines.push(`- … ${plural(todo.length - MAX_LINK_TARGETS, "weiteres Linkziel", "weitere Linkziele")} im Content-Mapping (URL-Drawer)`);
    }
    if (done) lines.push(`${plural(done, "Linkziel ist", "Linkziele sind")} bereits im Content verlinkt – dort ist nichts zu tun.`);
  }
  if (missing.some((i) => i.editorialArticleId) || partial.some((i) => i.editorialArticleId)) {
    lines.push("", `Mit „${EDITORIAL_MARK.trim()}“ markierte Topics sind als eigener Artikel geplant – hier nur kurz anreissen und nach Veröffentlichung verlinken.`);
  }

  lines.push("", "Abschluss:");
  if (open.every((i) => i.otherUrls === undefined)) {
    lines.push("- Der Abgleich mit den anderen URLs des Content-Mappings fehlt noch – vorher prüfen, ob Topics schon anderswo abgedeckt sind.");
  }
  lines.push("- Nach der Überarbeitung die Topic-Gap-Analyse im Content-Mapping neu starten und die Coverage prüfen.");
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
  const linkTaskIds = [...new Set(items.flatMap((i) => (i.otherUrls ?? []).flatMap((u) => (u.taskId ? [u.taskId] : []))))];
  const liveTaskIds = new Set(
    linkTaskIds.length ? (await tx.task.findMany({ where: { id: { in: linkTaskIds } }, select: { id: true } })).map((t) => t.id) : []
  );

  const created = await tx.task.create({
    data: {
      title: `Content-Gaps schliessen: ${gap.url.h1 || gap.url.url}`,
      description: taskDescription(gap.url.url, gap.focusKeyword, gap.coverageScore, gap.summary, items, liveTaskIds),
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
