import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/keyword-map/server";
import { TopicGapTaskError, createTopicGapLinkTask } from "@/lib/keyword-map/topic-gap-task";

/**
 * Legt für ein Topic einen Linking-Task mit den ausgewählten Linkempfehlungen im Kanban-Board (Backlog) an
 * (Body: `{ gapId, index, inventoryIds }`, `index` = Position in `results`).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { gapId?: unknown; index?: unknown; inventoryIds?: unknown };
    const { gapId, index, inventoryIds } = body;
    if (
      typeof gapId !== "string" ||
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      !Array.isArray(inventoryIds) ||
      inventoryIds.length === 0 ||
      inventoryIds.length > 100 ||
      !inventoryIds.every((v): v is string => typeof v === "string")
    ) {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }

    const result = await prisma.$transaction((tx) => createTopicGapLinkTask(tx, { gapId, urlId: id, index, inventoryIds, userId: user.id }));
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof TopicGapTaskError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[keyword-mapping/topic-gap/link-task] POST", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Task konnte nicht angelegt werden" }, { status: 500 });
  }
}
