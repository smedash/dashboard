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
    const period = searchParams.get("period") || "28d";

    if (!siteUrl) {
      return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
    }

    const { startDate, endDate } = getDateRange(period);

    const data = await getGSCSearchAnalytics(session.user.id, siteUrl, {
      startDate,
      endDate,
      dimensions: ["device"],
      rowLimit: 10,
    });

    return NextResponse.json({
      data: data.rows,
      period: { startDate, endDate },
    });
  } catch (error) {
    console.error("Error fetching GSC devices:", error);
    return NextResponse.json(
      { error: "Failed to fetch devices" },
      { status: 500 }
    );
  }
}


