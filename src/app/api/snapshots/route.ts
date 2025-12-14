import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGSCSearchAnalytics, getDateRange } from "@/lib/gsc";
import { NextRequest, NextResponse } from "next/server";

// GET - Alle Snapshots abrufen
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get("propertyId");

    const snapshots = await prisma.snapshot.findMany({
      where: propertyId ? { propertyId } : {},
      include: {
        property: true,
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error("Error fetching snapshots:", error);
    return NextResponse.json(
      { error: "Failed to fetch snapshots" },
      { status: 500 }
    );
  }
}

// POST - Neuen Snapshot erstellen
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, siteUrl, period } = body;

    if (!name || !siteUrl) {
      return NextResponse.json(
        { error: "Name and siteUrl are required" },
        { status: 400 }
      );
    }

    // Hole oder erstelle die Property
    let property = await prisma.gSCProperty.findFirst({
      where: { siteUrl, userId: session.user.id },
    });

    if (!property) {
      property = await prisma.gSCProperty.create({
        data: {
          siteUrl,
          userId: session.user.id,
        },
      });
    }

    const { startDate, endDate } = getDateRange(period || "28d");

    // Hole Daten von GSC für alle Dimensionen
    const [queriesData, pagesData, countriesData, devicesData, dateData] =
      await Promise.all([
        getGSCSearchAnalytics(session.user.id, siteUrl, {
          startDate,
          endDate,
          dimensions: ["query"],
          rowLimit: 500,
        }),
        getGSCSearchAnalytics(session.user.id, siteUrl, {
          startDate,
          endDate,
          dimensions: ["page"],
          rowLimit: 500,
        }),
        getGSCSearchAnalytics(session.user.id, siteUrl, {
          startDate,
          endDate,
          dimensions: ["country"],
          rowLimit: 100,
        }),
        getGSCSearchAnalytics(session.user.id, siteUrl, {
          startDate,
          endDate,
          dimensions: ["device"],
          rowLimit: 10,
        }),
        getGSCSearchAnalytics(session.user.id, siteUrl, {
          startDate,
          endDate,
          dimensions: ["date"],
          rowLimit: 100,
        }),
      ]);

    // Berechne Totals
    const calculateTotals = (rows: typeof queriesData.rows) => {
      const totals = rows.reduce(
        (acc, row) => ({
          clicks: acc.clicks + row.clicks,
          impressions: acc.impressions + row.impressions,
          position: acc.position + row.position,
          count: acc.count + 1,
        }),
        { clicks: 0, impressions: 0, position: 0, count: 0 }
      );

      return {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        position: totals.count > 0 ? totals.position / totals.count : 0,
      };
    };

    const totals = calculateTotals(dateData.rows);

    // Erstelle Snapshot mit Daten
    const snapshot = await prisma.snapshot.create({
      data: {
        name,
        description,
        propertyId: property.id,
        userId: session.user.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totals,
        data: {
          create: [
            ...queriesData.rows.map((row) => ({
              dimension: "query",
              key: row.keys[0],
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            })),
            ...pagesData.rows.map((row) => ({
              dimension: "page",
              key: row.keys[0],
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            })),
            ...countriesData.rows.map((row) => ({
              dimension: "country",
              key: row.keys[0],
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            })),
            ...devicesData.rows.map((row) => ({
              dimension: "device",
              key: row.keys[0],
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            })),
            ...dateData.rows.map((row) => ({
              dimension: "date",
              key: row.keys[0],
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            })),
          ],
        },
      },
      include: {
        property: true,
        _count: { select: { data: true } },
      },
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error("Error creating snapshot:", error);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 }
    );
  }
}

