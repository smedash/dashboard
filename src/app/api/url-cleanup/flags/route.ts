import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recomputeKillScores } from "@/lib/url-cleanup/recompute";

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      ids?: string[];
      status?: string;
      note?: string;
    };
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    const status = body.status;
    if (ids.length === 0 || !status) {
      return NextResponse.json({ error: "ids und status erforderlich" }, { status: 400 });
    }
    if (!["none", "candidate", "keep", "kill"].includes(status)) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }

    await prisma.urlInventory.updateMany({
      where: { id: { in: ids } },
      data: {
        cleanupStatus: status,
        ...(body.note !== undefined ? { cleanupNote: body.note } : {}),
      },
    });

    await recomputeKillScores({ ids });
    return NextResponse.json({ updated: ids.length });
  } catch (e) {
    console.error("[url-cleanup/flags]", e);
    return NextResponse.json({ error: "Update fehlgeschlagen" }, { status: 500 });
  }
}
