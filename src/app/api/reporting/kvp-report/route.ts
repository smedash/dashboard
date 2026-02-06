import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // Format: YYYY-MM (Rückwärtskompatibel)
    const fromParam = searchParams.get("from"); // Format: YYYY-MM-DD
    const toParam = searchParams.get("to"); // Format: YYYY-MM-DD
    const categoryFilter = searchParams.get("category") || "";

    // Bestimme Start- und End-Datum
    let startDate: Date;
    let endDate: Date;

    if (fromParam && toParam) {
      // Benutzerdefinierter Datumsbereich
      startDate = new Date(fromParam + "T00:00:00");
      endDate = new Date(toParam + "T23:59:59.999");
    } else if (monthParam) {
      // Einzelner Monat (Rückwärtskompatibel)
      const [year, month] = monthParam.split("-").map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      // Standard: aktueller Monat
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Hole alle KVP URLs im gewählten Zeitraum
    const whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (categoryFilter) {
      whereClause.category = categoryFilter;
    }

    const kvpUrls = await prisma.kVPUrl.findMany({
      where: whereClause,
      include: {
        subkeywords: {
          orderBy: { createdAt: "asc" },
        },
        comments: {
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
        },
      } as any,
      orderBy: { createdAt: "desc" },
    });

    // Hole Maturity Links für alle KVP URLs
    const kvpUrlIds = kvpUrls.map((url: any) => url.id);
    const maturityLinks = kvpUrlIds.length > 0
      ? await prisma.kVPMaturityItemLink.findMany({
          where: {
            kvpUrlId: { in: kvpUrlIds },
          },
          include: {
            maturityItem: {
              include: {
                maturity: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        })
      : [];

    // Gruppiere Maturity Links nach KVP URL
    const maturityLinksByUrl = maturityLinks.reduce((acc: any, link: any) => {
      if (!acc[link.kvpUrlId]) acc[link.kvpUrlId] = [];
      acc[link.kvpUrlId].push(link);
      return acc;
    }, {} as Record<string, any[]>);

    // Kombiniere KVP URLs mit ihren Maturity Links
    const kvpUrlsWithMaturity = kvpUrls.map((url: any) => ({
      ...url,
      maturityLinks: maturityLinksByUrl[url.id] || [],
    }));

    // Berechne Statistiken
    const totalKvps = kvpUrls.length;
    const totalSubkeywords = kvpUrls.reduce(
      (sum: number, url: any) => sum + (url.subkeywords?.length || 0),
      0
    );
    const totalFocusKeywords = new Set(kvpUrls.map((url: any) => url.focusKeyword)).size;
    const totalMaturityLinks = maturityLinks.length;
    const uniqueMaturityItems = new Set(maturityLinks.map((link: any) => link.maturityItemId)).size;

    // Kategorieverteilung
    const categoryDistribution = kvpUrls.reduce((acc: any, url: any) => {
      const cat = url.category || "Keine Kategorie";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryStats = Object.entries(categoryDistribution).map(
      ([category, count]) => ({
        category,
        count: count as number,
      })
    );

    // Reifegrad-Kategorien Auswertung (welche Maturity-Kategorien wurden adressiert)
    const maturityCategoryDistribution = maturityLinks.reduce(
      (acc: any, link: any) => {
        const cat = link.maturityItem.category;
        if (!acc[cat]) {
          acc[cat] = { count: 0, items: new Set() };
        }
        acc[cat].count++;
        acc[cat].items.add(link.maturityItem.title);
        return acc;
      },
      {} as Record<string, { count: number; items: Set<string> }>
    );

    const maturityCategoryStats = Object.entries(maturityCategoryDistribution).map(
      ([category, data]: [string, any]) => ({
        category,
        linkCount: data.count,
        uniqueItems: data.items.size,
        items: Array.from(data.items) as string[],
      })
    );

    // Hole ALLE KVP URLs für die monatliche Übersicht (alle Monate)
    const allKvpUrls = await prisma.kVPUrl.findMany({
      select: {
        id: true,
        createdAt: true,
        category: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Monatliche Übersicht
    const monthlyOverview = allKvpUrls.reduce((acc: any, url: any) => {
      const date = new Date(url.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      acc[monthKey] = (acc[monthKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const monthlyStats = Object.entries(monthlyOverview)
      .map(([month, count]) => ({
        month,
        count: count as number,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    // Verfügbare Monate für den Selector
    const availableMonths = monthlyStats.map((m) => m.month);

    // Gesamtzeitraum bestimmen (frühester und spätester KVP)
    const dateRange = allKvpUrls.length > 0
      ? {
          earliest: allKvpUrls[0].createdAt.toISOString(),
          latest: allKvpUrls[allKvpUrls.length - 1].createdAt.toISOString(),
        }
      : null;

    return NextResponse.json({
      kvpUrls: kvpUrlsWithMaturity,
      stats: {
        totalKvps,
        totalSubkeywords,
        totalFocusKeywords,
        totalMaturityLinks,
        uniqueMaturityItems,
      },
      categoryStats,
      maturityCategoryStats,
      monthlyStats,
      availableMonths,
      dateRange,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching KVP report:", error);
    return NextResponse.json(
      { error: "Failed to fetch KVP report data" },
      { status: 500 }
    );
  }
}
