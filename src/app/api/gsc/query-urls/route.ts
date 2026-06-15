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
    const query = searchParams.get("query");

    if (!siteUrl) {
      return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
    }

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const { startDate, endDate } = startDateParam && endDateParam
      ? { startDate: startDateParam, endDate: endDateParam }
      : getDateRange(period || "28d");

    const data = await getGSCSearchAnalytics(session.user.id, siteUrl, {
      startDate,
      endDate,
      dimensions: ["query", "page"],
      rowLimit: 100,
      queryFilter: query,
    });

    return NextResponse.json({
      data: data.rows,
      period: { startDate, endDate },
    });
  } catch (error) {
    console.error("Error fetching GSC query URLs:", error);
    return NextResponse.json(
      { error: "Failed to fetch query URLs" },
      { status: 500 }
    );
  }
}
