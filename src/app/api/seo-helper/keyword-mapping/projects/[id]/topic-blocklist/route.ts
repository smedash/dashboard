import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blockTopics, unblockTopics } from "@/lib/keyword-map/brands";
import { requireUser } from "@/lib/keyword-map/server";

export const maxDuration = 120;

const MAX_TOPICS = 1000;

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, MAX_TOPICS);
  return list.length > 0 ? list : null;
}

async function projectExists(id: string) {
  return !!(await prisma.keywordMapProject.findUnique({ where: { id }, select: { id: true } }));
}

/** Gesperrte Topics des Projekts */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const rows = await prisma.keywordMapTopicBlock.findMany({
      where: { projectId: id },
      select: { key: true, topic: true, createdAt: true },
      orderBy: { topic: "asc" },
    });
    return NextResponse.json({ topics: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  } catch (e) {
    console.error("[keyword-mapping/projects/[id]/topic-blocklist] GET", e);
    return NextResponse.json({ error: "Sperrliste konnte nicht geladen werden" }, { status: 500 });
  }
}

/** Topics löschen und sperren (Body: `{ topics: string[] }`) */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { topics?: unknown };
    const topics = stringList(body.topics);
    if (!topics) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    if (!(await projectExists(id))) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    return NextResponse.json(await blockTopics(id, topics, user.id));
  } catch (e) {
    console.error("[keyword-mapping/projects/[id]/topic-blocklist] POST", e);
    return NextResponse.json({ error: "Topics konnten nicht gelöscht werden" }, { status: 500 });
  }
}

/** Sperren aufheben (Body: `{ keys: string[] }`) */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { keys?: unknown };
    const keys = stringList(body.keys);
    if (!keys) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    return NextResponse.json(await unblockTopics(id, keys));
  } catch (e) {
    console.error("[keyword-mapping/projects/[id]/topic-blocklist] DELETE", e);
    return NextResponse.json({ error: "Sperren konnten nicht aufgehoben werden" }, { status: 500 });
  }
}
