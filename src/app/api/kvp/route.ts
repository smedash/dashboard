import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { canEdit } from "@/lib/rbac";
import { isValidKvpCategory, syncKvpRankTrackerKeywords } from "@/lib/kvp";

// GET - Alle KVP URLs abrufen (teamweiter Zugriff)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Teamweiter Zugriff - keine userId-Filterung
    const kvpUrls = await prisma.kVPUrl.findMany({
      include: {
        subkeywords: {
          orderBy: { createdAt: "asc" },
        },
        comments: {
          orderBy: { createdAt: "asc" },
        },
        files: {
          orderBy: { createdAt: "desc" },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      } as any, // Type assertion bis Prisma Client neu generiert wurde
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ urls: kvpUrls });
  } catch (error) {
    console.error("Error fetching KVP URLs:", error);
    return NextResponse.json(
      { error: "Failed to fetch KVP URLs" },
      { status: 500 }
    );
  }
}

// POST - Neue KVP URL erstellen (nur Member und Superadmin)
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
    const { url, focusKeyword, category, comment, subkeywords, assigneeIds } = body;

    if (!url || !focusKeyword) {
      return NextResponse.json(
        { error: "URL und Fokuskeyword sind erforderlich" },
        { status: 400 }
      );
    }

    // Validiere Kategorie
    if (category && !isValidKvpCategory(category)) {
      return NextResponse.json(
        { error: "Ungültige Kategorie" },
        { status: 400 }
      );
    }

    // Erstelle KVP URL
    const kvpUrl = await prisma.kVPUrl.create({
      data: {
        url,
        focusKeyword,
        ...(category && { category: category as any }), // Type assertion bis Prisma Client neu generiert wurde
        comment: comment || null, // Deprecated, wird durch comments ersetzt
        userId: session.user.id,
        subkeywords: {
          create: (subkeywords || []).map((keyword: string) => ({
            keyword: keyword.trim(),
          })),
        },
        // Erstelle Nutzerzuweisungen
        assignees: {
          create: (assigneeIds || []).map((userId: string) => ({
            userId,
          })),
        },
      } as any,
      include: {
        subkeywords: {
          orderBy: { createdAt: "asc" },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Erstelle Kommentar, falls vorhanden (über direkte SQL-Abfrage, da Prisma Client noch nicht aktualisiert)
    let comments: any[] = [];
    if (comment && comment.trim()) {
      try {
        // Generiere eine ID (ähnlich wie cuid)
        const commentId = `c${randomBytes(16).toString('hex')}`;
        const now = new Date();
        
        // Verwende Prisma mit Raw SQL, da der Client noch nicht aktualisiert wurde
        const result = await prisma.$queryRaw<any[]>`
          INSERT INTO "KVPComment" ("id", "urlId", "text", "createdAt", "updatedAt")
          VALUES (${commentId}, ${kvpUrl.id}, ${comment.trim()}, ${now}, ${now})
          RETURNING *
        `;
        
        if (result && result.length > 0) {
          comments = [result[0]];
        }
      } catch (error) {
        console.error("Error creating comment:", error);
        // Kommentar konnte nicht erstellt werden, aber URL wurde erstellt
      }
    }

    const kvpUrlWithComments = {
      ...kvpUrl,
      comments,
      assignees: (kvpUrl as any).assignees || [],
    };

    const addedKeywords = await syncKvpRankTrackerKeywords({
      userId: session.user.id,
      url,
      keywords: [focusKeyword, ...(subkeywords || [])],
      category,
    });

    return NextResponse.json({ 
      url: kvpUrlWithComments,
      addedKeywords: addedKeywords.length,
    });
  } catch (error) {
    console.error("Error creating KVP URL:", error);
    return NextResponse.json(
      { error: "Failed to create KVP URL" },
      { status: 500 }
    );
  }
}
