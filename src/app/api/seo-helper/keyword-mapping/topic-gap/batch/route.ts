import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/keyword-map/server";
import { advanceTopicGapBatch, countNewTopicJobs, loadTopicGapBatch, projectsInBatch } from "@/lib/keyword-map/topic-gap-batch";
import { getAccount } from "@/lib/topicloops";

export const maxDuration = 300;

function flag(value: string | null): boolean {
  return value === "1" || value === "true";
}

async function assertProject(projectId: string | null) {
  if (!projectId) return null;
  const project = await prisma.keywordMapProject.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  return null;
}

/** Vorschau: wie viele URLs analysiert würden, ohne einen Lauf zu starten. */
export async function GET(request: NextRequest) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  const projectId = request.nextUrl.searchParams.get("projectId");
  const force = flag(request.nextUrl.searchParams.get("force"));
  const refreshTopics = flag(request.nextUrl.searchParams.get("refreshTopics"));

  try {
    const missing = await assertProject(projectId);
    if (missing) return missing;

    const snapshot = await loadTopicGapBatch({ projectId, force, refreshTopics, startedAt: null });
    const newJobs = await countNewTopicJobs(snapshot.items, refreshTopics);
    let credits: number | null = null;
    if (process.env.TOPICLOOPS_API_KEY) {
      try {
        credits = (await getAccount()).credits;
      } catch {
        credits = null;
      }
    }

    return NextResponse.json({
      totalUrls: snapshot.totalUrls,
      skippedNoKeyword: snapshot.skippedNoKeyword,
      skippedDone: snapshot.skippedDone,
      pending: snapshot.items.length,
      resumable: snapshot.items.filter((item) => item.resumeGapId).length,
      newJobs,
      credits,
      projects: projectsInBatch(snapshot.items),
    });
  } catch (e) {
    console.error("[keyword-mapping/topic-gap/batch] GET", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Vorschau fehlgeschlagen" }, { status: 500 });
  }
}

/**
 * Ein Schritt des Batch-Laufs. Der Browser ruft das wiederholt auf, bis `done` true ist.
 * So bleibt jeder Request innerhalb des Zeitlimits, auch bei hunderten URLs.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      projectId?: string | null;
      force?: boolean;
      refreshTopics?: boolean;
      startedAt?: string;
    };
    const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : null;
    const startedAt = new Date(body.startedAt ?? "");
    if (Number.isNaN(startedAt.getTime())) {
      return NextResponse.json({ error: "startedAt fehlt" }, { status: 400 });
    }
    const missing = await assertProject(projectId);
    if (missing) return missing;

    const step = await advanceTopicGapBatch({
      projectId,
      userId: user.id,
      force: body.force === true,
      refreshTopics: body.refreshTopics === true,
      startedAt,
    });
    return NextResponse.json(step);
  } catch (e) {
    console.error("[keyword-mapping/topic-gap/batch] POST", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Analyse konnte nicht fortgesetzt werden" }, { status: 500 });
  }
}
