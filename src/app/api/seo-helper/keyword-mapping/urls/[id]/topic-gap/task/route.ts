import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/keyword-map/server";
import { TopicGapTaskError, createTopicGapTask } from "@/lib/keyword-map/topic-gap-task";

/** Legt aus einer Gap-Analyse einen Task im Kanban-Board (Backlog) an (Body: `{ gapId }`). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { gapId?: unknown };
    if (typeof body.gapId !== "string") return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    const gapId = body.gapId;

    const task = await prisma.$transaction((tx) => createTopicGapTask(tx, gapId, id, user.id));
    return NextResponse.json({ task });
  } catch (e) {
    if (e instanceof TopicGapTaskError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[keyword-mapping/topic-gap/task] POST", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Task konnte nicht angelegt werden" }, { status: 500 });
  }
}
