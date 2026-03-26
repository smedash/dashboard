import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperadmin } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const maturity = await prisma.sEOMaturity.findUnique({
      where: { id },
    });

    if (!maturity) {
      return NextResponse.json({ error: "SEO maturity not found" }, { status: 404 });
    }

    if (maturity.userId !== session.user.id && !isSuperadmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const [logs, total] = await Promise.all([
      prisma.sEOMaturityChangeLog.findMany({
        where: { maturityId: id },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.sEOMaturityChangeLog.count({
        where: { maturityId: id },
      }),
    ]);

    return NextResponse.json({ logs, total });
  } catch (error) {
    console.error("Error fetching changelog:", error);
    return NextResponse.json(
      { error: "Failed to fetch changelog" },
      { status: 500 }
    );
  }
}
