import { auth } from "@/lib/auth";
import {
  getGSCSearchAnalytics,
  getDateRange,
  getPreviousPeriodRange,
} from "@/lib/gsc";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteUrl = searchParams.get("siteUrl");
    const period = searchParams.get("period") || "28d";
    const urlFilter = searchParams.get("urlFilter") || "";

    if (!siteUrl) {
      return NextResponse.json(
        { error: "siteUrl is required" },
        { status: 400 }
      );
    }

    const { startDate, endDate } = getDateRange(period);
    const prevPeriod = getPreviousPeriodRange(startDate, endDate);

    // Gemeinsame Filter-Optionen
    const filterOpts = urlFilter ? { urlPathFilter: urlFilter } : {};

    // Alle Daten parallel laden
    const [
      dateData,
      prevDateData,
      queriesData,
      pagesData,
      devicesData,
    ] = await Promise.all([
      // Aktuelle Periode: Tageswerte
      getGSCSearchAnalytics(session.user.id, siteUrl, {
        startDate,
        endDate,
        dimensions: ["date"],
        rowLimit: 1000,
        ...filterOpts,
      }),
      // Vorperiode: Tageswerte
      getGSCSearchAnalytics(session.user.id, siteUrl, {
        startDate: prevPeriod.startDate,
        endDate: prevPeriod.endDate,
        dimensions: ["date"],
        rowLimit: 1000,
        ...filterOpts,
      }),
      // Top Keywords
      getGSCSearchAnalytics(session.user.id, siteUrl, {
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: 500,
        ...filterOpts,
      }),
      // Top Pages
      getGSCSearchAnalytics(session.user.id, siteUrl, {
        startDate,
        endDate,
        dimensions: ["page"],
        rowLimit: 500,
        ...filterOpts,
      }),
      // Geräte-Verteilung
      getGSCSearchAnalytics(session.user.id, siteUrl, {
        startDate,
        endDate,
        dimensions: ["device"],
        rowLimit: 10,
        ...filterOpts,
      }),
    ]);

    // --- Totals berechnen ---
    const calcTotals = (rows: typeof dateData.rows) => {
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
        ctr:
          totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        position:
          totals.count > 0 ? totals.position / totals.count : 0,
      };
    };

    const currentTotals = calcTotals(dateData.rows);
    const previousTotals = calcTotals(prevDateData.rows);

    // --- Veränderungen ---
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const changes = {
      clicks: calcChange(currentTotals.clicks, previousTotals.clicks),
      impressions: calcChange(
        currentTotals.impressions,
        previousTotals.impressions
      ),
      ctr: calcChange(currentTotals.ctr, previousTotals.ctr),
      position: calcChange(currentTotals.position, previousTotals.position),
    };

    // --- Tagestrend ---
    const dailyTrend = dateData.rows
      .map((row) => ({
        date: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- Top Keywords ---
    const topKeywords = queriesData.rows
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50)
      .map((row) => ({
        keyword: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }));

    // --- Top Pages ---
    const topPages = pagesData.rows
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50)
      .map((row) => {
        let pathname = row.keys[0];
        try {
          pathname = new URL(row.keys[0]).pathname;
        } catch {
          // keep as is
        }
        return {
          url: row.keys[0],
          pathname,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        };
      });

    // --- Devices ---
    const devices = devicesData.rows.map((row) => ({
      device: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));

    // --- Verzeichnis-Statistiken ---
    const dirMap = new Map<
      string,
      { clicks: number; impressions: number; position: number; count: number }
    >();

    pagesData.rows.forEach((row) => {
      try {
        const urlObj = new URL(row.keys[0]);
        const pathParts = urlObj.pathname.split("/").filter(Boolean);
        const dirPath = "/" + pathParts.slice(0, 2).join("/");

        if (!dirMap.has(dirPath)) {
          dirMap.set(dirPath, {
            clicks: 0,
            impressions: 0,
            position: 0,
            count: 0,
          });
        }
        const dir = dirMap.get(dirPath)!;
        dir.clicks += row.clicks;
        dir.impressions += row.impressions;
        dir.position += row.position;
        dir.count++;
      } catch {
        // skip invalid URLs
      }
    });

    const directories = Array.from(dirMap.entries())
      .map(([path, stats]) => ({
        path,
        clicks: stats.clicks,
        impressions: stats.impressions,
        ctr:
          stats.impressions > 0 ? stats.clicks / stats.impressions : 0,
        position: stats.count > 0 ? stats.position / stats.count : 0,
        pageCount: stats.count,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20);

    return NextResponse.json({
      period: { startDate, endDate },
      previousPeriod: prevPeriod,
      urlFilter: urlFilter || null,
      current: currentTotals,
      previous: previousTotals,
      changes,
      dailyTrend,
      topKeywords,
      topPages,
      devices,
      directories,
    });
  } catch (error) {
    console.error("Error fetching traffic report:", error);

    if (
      error instanceof Error &&
      error.message === "No Google account connected"
    ) {
      return NextResponse.json(
        { error: "Google account not connected", needsConnection: true },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch traffic report" },
      { status: 500 }
    );
  }
}
