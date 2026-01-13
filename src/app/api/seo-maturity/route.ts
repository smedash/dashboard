import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Alle SEO Reifegrad Analysen abrufen
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const maturities = await prisma.sEOMaturity.findMany({
      where: { userId: session.user.id },
      include: {
        items: {
          orderBy: [{ category: "asc" }, { order: "asc" }],
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ maturities });
  } catch (error) {
    console.error("Error fetching SEO maturity:", error);
    return NextResponse.json(
      { error: "Failed to fetch SEO maturity" },
      { status: 500 }
    );
  }
}

// POST - Neue SEO Reifegrad Analyse erstellen
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, items } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const maturity = await prisma.sEOMaturity.create({
      data: {
        name,
        description: description || null,
        userId: session.user.id,
        items: {
          create: items?.map((item: any, index: number) => ({
            category: item.category || "Allgemein",
            title: item.title,
            description: item.description || null,
            score: item.score || 1,
            order: item.order !== undefined ? item.order : index,
          })) || [],
        },
      },
      include: {
        items: {
          orderBy: [{ category: "asc" }, { order: "asc" }],
        },
      },
    });

    return NextResponse.json({ maturity });
  } catch (error) {
    console.error("Error creating SEO maturity:", error);
    return NextResponse.json(
      { error: "Failed to create SEO maturity" },
      { status: 500 }
    );
  }
}
