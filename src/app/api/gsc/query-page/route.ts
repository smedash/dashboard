import { auth } from "@/lib/auth";
import { getGSCSearchAnalytics, getDateRange } from "@/lib/gsc";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const siteUrl = searchParams.get("siteUrl");
    const period = searchParams.get("period");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "25000");

    if (!siteUrl) {
      return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
    }

    // Use direct dates if provided, otherwise use period
    const { startDate, endDate } = startDateParam && endDateParam
      ? { startDate: startDateParam, endDate: endDateParam }
      : getDateRange(period || "28d");

    const data = await getGSCSearchAnalytics(session.user.id, siteUrl, {
      startDate,
      endDate,
      dimensions: ["query", "page"],
      rowLimit: limit,
    });

    return NextResponse.json({
      data: data.rows,
      period: { startDate, endDate },
    });
  } catch (error) {
    console.error("Error fetching GSC query-page data:", error);
    
    if (error instanceof Error && error.message === "No Google account connected") {
      return NextResponse.json(
        { error: "Google account not connected", needsConnection: true },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to fetch query-page data" },
      { status: 500 }
    );
  }
}
