import { auth } from "@/lib/auth";
import { getGSCSearchAnalytics, getDateRange, getPreviousPeriodRange } from "@/lib/gsc";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const siteUrl = searchParams.get("siteUrl");
    const period = searchParams.get("period") || "28d";
    const dimension = searchParams.get("dimension") || "date";

    if (!siteUrl) {
      return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
    }

    const { startDate, endDate } = getDateRange(period);
    const prevPeriod = getPreviousPeriodRange(startDate, endDate);

    // Fetch current period data
    const currentData = await getGSCSearchAnalytics(session.user.id, siteUrl, {
      startDate,
      endDate,
      dimensions: [dimension],
      rowLimit: 1000,
    });

    // Fetch previous period data for comparison
    const previousData = await getGSCSearchAnalytics(session.user.id, siteUrl, {
      startDate: prevPeriod.startDate,
      endDate: prevPeriod.endDate,
      dimensions: [dimension],
      rowLimit: 1000,
    });

    // Calculate totals
    const currentTotals = currentData.rows.reduce(
      (acc, row) => ({
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
        ctr: 0,
        position: acc.position + row.position,
        count: acc.count + 1,
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 }
    );

    const previousTotals = previousData.rows.reduce(
      (acc, row) => ({
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
        ctr: 0,
        position: acc.position + row.position,
        count: acc.count + 1,
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 }
    );

    // Calculate averages and changes
    const avgCurrentPosition = currentTotals.count > 0 ? currentTotals.position / currentTotals.count : 0;
    const avgPreviousPosition = previousTotals.count > 0 ? previousTotals.position / previousTotals.count : 0;
    const currentCTR = currentTotals.impressions > 0 ? currentTotals.clicks / currentTotals.impressions : 0;
    const previousCTR = previousTotals.impressions > 0 ? previousTotals.clicks / previousTotals.impressions : 0;

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return NextResponse.json({
      current: {
        clicks: currentTotals.clicks,
        impressions: currentTotals.impressions,
        ctr: currentCTR,
        position: avgCurrentPosition,
      },
      previous: {
        clicks: previousTotals.clicks,
        impressions: previousTotals.impressions,
        ctr: previousCTR,
        position: avgPreviousPosition,
      },
      changes: {
        clicks: calculateChange(currentTotals.clicks, previousTotals.clicks),
        impressions: calculateChange(currentTotals.impressions, previousTotals.impressions),
        ctr: calculateChange(currentCTR, previousCTR),
        position: calculateChange(avgCurrentPosition, avgPreviousPosition),
      },
      chartData: currentData.rows,
      period: { startDate, endDate },
      previousPeriod: prevPeriod,
    });
  } catch (error) {
    console.error("Error fetching GSC stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

