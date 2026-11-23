import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectMaxTotalSv, mapUrlInclude, requireUser, serializeUrls } from "@/lib/keyword-map/server";
import { TopicGapTaskError, createTopicGapTask } from "@/lib/keyword-map/topic-gap-task";

export const maxDuration = 120;

const MAX_BATCH = 100;

type TaskResult = { status: "created" | "exists" | "skipped" | "error"; taskId?: string; reason?: string };

/** Body: `{ ids }` – legt für jede URL aus ihrer neuesten abgeschlossenen Gap-Analyse einen Task im Kanban-Backlog an. */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
    if (ids.length === 0) return NextResponse.json({ results: {}, urls: [] });
    if (ids.length > MAX_BATCH) {
      return NextResponse.json({ error: `Maximal ${MAX_BATCH} URLs pro Anfrage` }, { status: 400 });
    }

    const rows = await prisma.keywordMapUrl.findMany({
      where: { id: { in: ids } },
      select: { id: true, topicGaps: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } } },
    });
    const results: Record<string, TaskResult> = {};

    for (const row of rows) {
      const gap = row.topicGaps[0];
      if (!gap) {
        results[row.id] = { status: "skipped", reason: "Keine Topic-Gap-Analyse" };
        continue;
      }
      if (gap.status !== "succeeded") {
        results[row.id] = { status: "skipped", reason: "Analyse ist noch nicht abgeschlossen" };
        continue;
      }
      try {
        const task = await prisma.$transaction((tx) => createTopicGapTask(tx, gap.id, row.id, user.id));
        results[row.id] = { status: "created", taskId: task.id };
      } catch (e) {
        if (e instanceof TopicGapTaskError && e.status === 409) results[row.id] = { status: "exists" };
        else if (e instanceof TopicGapTaskError) results[row.id] = { status: "skipped", reason: e.message };
        else {
          console.error("[keyword-mapping/topic-gap-tasks]", row.id, e);
          results[row.id] = { status: "error", reason: e instanceof Error ? e.message : "Task konnte nicht angelegt werden" };
        }
      }
    }

    const fresh = await prisma.keywordMapUrl.findMany({ where: { id: { in: ids } }, include: mapUrlInclude });
    const max = fresh[0] ? await getProjectMaxTotalSv(fresh[0].projectId) : 0;
    return NextResponse.json({ results, urls: serializeUrls(fresh, max) });
  } catch (e) {
    console.error("[keyword-mapping/topic-gap-tasks]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Tasks konnten nicht angelegt werden" }, { status: 500 });
  }
}
