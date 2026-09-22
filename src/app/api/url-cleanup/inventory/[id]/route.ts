import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const row = await prisma.urlInventory.findUnique({
    where: { id },
    include: {
      sitemaps: { include: { sitemap: true } },
      dimensionValues: { include: { dimension: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ row });
}
