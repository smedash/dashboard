import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url, keyword, frequency = "weekly", alertThreshold = 10 } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "url ist erforderlich" }, { status: 400 });
    }

    try {
      const monitor = await db.urlCheckMonitor.upsert({
        where: { userId_url: { userId: session.user.id, url } },
        create: {
          userId: session.user.id,
          url,
          keyword: keyword || null,
          frequency,
          alertThreshold,
          isActive: true,
        },
        update: {
          keyword: keyword || null,
          frequency,
          alertThreshold,
          isActive: true,
        },
      });
      return NextResponse.json({ monitor, created: true });
    } catch {
      return NextResponse.json({ error: "Migration pending - Monitoring-Tabelle existiert noch nicht." }, { status: 500 });
    }
  } catch (error) {
    console.error("[url-checker/monitor]", error);
    return NextResponse.json({ error: "Fehler beim Einrichten des Monitorings." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const monitors = await db.urlCheckMonitor.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ monitors });
    } catch {
      return NextResponse.json({ monitors: [] });
    }
  } catch (error) {
    console.error("[url-checker/monitor]", error);
    return NextResponse.json({ error: "Fehler." }, { status: 500 });
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
      return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
    }

    try {
      await db.urlCheckMonitor.delete({
        where: { id, userId: session.user.id },
      });
      return NextResponse.json({ deleted: true });
    } catch {
      return NextResponse.json({ error: "Nicht gefunden oder Migration pending." }, { status: 404 });
    }
  } catch (error) {
    console.error("[url-checker/monitor]", error);
    return NextResponse.json({ error: "Fehler." }, { status: 500 });
  }
}
