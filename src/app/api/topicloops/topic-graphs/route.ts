import { createTopicGraph, getTopicGraph } from "@/lib/topicloops";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

function countTopics(node: { children?: unknown[] }): number {
  let count = 1;
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countTopics(child as { children?: unknown[] });
    }
  }
  return count;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { keyword, country_code, language_code } = body;

    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
      return NextResponse.json({ error: "Keyword ist erforderlich" }, { status: 400 });
    }

    const normalizedKeyword = keyword.trim().toLowerCase();
    const cc = country_code ?? "ch";
    const lc = language_code ?? "de";

    const existing = await prisma.topicGraph.findUnique({
      where: {
        keyword_countryCode_languageCode: {
          keyword: normalizedKeyword,
          countryCode: cc,
          languageCode: lc,
        },
      },
    });

    if (existing && existing.status === "succeeded" && existing.topicGraph) {
      return NextResponse.json({
        id: existing.id,
        created_at: existing.createdAt.toISOString(),
        parameters: {
          country_code: existing.countryCode,
          language_code: existing.languageCode,
          keyword: existing.keyword,
        },
        status: "succeeded",
        topic_graph: JSON.parse(existing.topicGraph),
        cached: true,
      });
    }

    const result = await createTopicGraph(normalizedKeyword, {
      country_code: cc,
      language_code: lc,
    });

    const saved = await prisma.topicGraph.upsert({
      where: {
        keyword_countryCode_languageCode: {
          keyword: normalizedKeyword,
          countryCode: cc,
          languageCode: lc,
        },
      },
      create: {
        userId: session.user.id,
        keyword: normalizedKeyword,
        countryCode: cc,
        languageCode: lc,
        topicloopsId: result.id,
        status: "processing",
      },
      update: {
        topicloopsId: result.id,
        status: "processing",
        topicGraph: null,
        totalTopics: 0,
      },
    });

    return NextResponse.json({
      id: saved.id,
      topicloopsId: result.id,
      status: "processing",
    });
  } catch (error) {
    console.error("[API TopicLoops] Fehler:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const listAll = searchParams.get("all");

    if (listAll === "true") {
      const graphs = await prisma.topicGraph.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          keyword: true,
          countryCode: true,
          languageCode: true,
          status: true,
          topicGraph: true,
          totalTopics: true,
          createdAt: true,
        },
      });

      return NextResponse.json(
        graphs.map((g) => ({
          id: g.id,
          created_at: g.createdAt.toISOString(),
          parameters: {
            country_code: g.countryCode,
            language_code: g.languageCode,
            keyword: g.keyword,
          },
          status: g.status,
          topic_graph: g.topicGraph ? JSON.parse(g.topicGraph) : null,
          totalTopics: g.totalTopics,
        }))
      );
    }

    if (!id) {
      return NextResponse.json({ error: "Job-ID ist erforderlich" }, { status: 400 });
    }

    const dbEntry = await prisma.topicGraph.findFirst({
      where: {
        OR: [{ id }, { topicloopsId: id }],
        userId: session.user.id,
      },
    });

    if (!dbEntry) {
      return NextResponse.json({ error: "Job nicht gefunden" }, { status: 404 });
    }

    if (dbEntry.status === "succeeded" && dbEntry.topicGraph) {
      return NextResponse.json({
        id: dbEntry.id,
        created_at: dbEntry.createdAt.toISOString(),
        parameters: {
          country_code: dbEntry.countryCode,
          language_code: dbEntry.languageCode,
          keyword: dbEntry.keyword,
        },
        status: "succeeded",
        topic_graph: JSON.parse(dbEntry.topicGraph),
      });
    }

    const apiResult = await getTopicGraph(dbEntry.topicloopsId);

    if (apiResult.status === "succeeded" && apiResult.topic_graph) {
      const total = countTopics(apiResult.topic_graph);
      await prisma.topicGraph.update({
        where: { id: dbEntry.id },
        data: {
          status: "succeeded",
          topicGraph: JSON.stringify(apiResult.topic_graph),
          totalTopics: total,
        },
      });
    } else if (apiResult.status === "failed") {
      await prisma.topicGraph.update({
        where: { id: dbEntry.id },
        data: { status: "failed" },
      });
    }

    return NextResponse.json({
      id: dbEntry.id,
      created_at: dbEntry.createdAt.toISOString(),
      parameters: {
        country_code: dbEntry.countryCode,
        language_code: dbEntry.languageCode,
        keyword: dbEntry.keyword,
      },
      status: apiResult.status,
      topic_graph: apiResult.topic_graph,
    });
  } catch (error) {
    console.error("[API TopicLoops] Fehler:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
    }

    await prisma.topicGraph.deleteMany({
      where: { id, userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API TopicLoops] Delete Fehler:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
