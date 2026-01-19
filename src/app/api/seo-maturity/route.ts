import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { canEdit } from "@/lib/rbac";

// GET - Alle SEO Reifegrad Analysen abrufen (teamweiter Zugriff)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Teamweiter Zugriff - keine userId-Filterung
    const maturities = await prisma.sEOMaturity.findMany({
      include: {
        items: {
          include: {
            teams: {
              include: {
                team: true,
              },
            },
          },
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

// POST - Neue SEO Reifegrad Analyse erstellen (nur Member und Superadmin)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rollenprüfung: Viewer können nicht bearbeiten
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten" }, { status: 403 });
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
            priority: item.priority || null,
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
