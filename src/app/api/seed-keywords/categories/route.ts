import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await prisma.seedKeyword.groupBy({
      by: ["category"],
      _count: { id: true },
      orderBy: { category: "asc" },
    });

    const categories = result.map((r) => ({
      name: r.category,
      count: r._count.id,
    }));

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Seed-Keywords Categories GET error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
