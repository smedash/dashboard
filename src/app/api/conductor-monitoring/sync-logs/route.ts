import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findConductorWebsiteForDomain, getConductorSyncLogs } from "@/lib/conductor-data";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const domain = request.nextUrl.searchParams.get("domain");
    if (!domain) {
      return NextResponse.json({ error: "domain Parameter fehlt" }, { status: 400 });
    }

    const website = await findConductorWebsiteForDomain(domain);
    if (!website) {
      return NextResponse.json({ logs: [], lastSyncAt: null });
    }

    const logs = await getConductorSyncLogs(website.id);
    return NextResponse.json({ logs, lastSyncAt: website.lastSyncAt });
  } catch (error) {
    console.error("[Conductor Sync Logs]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Laden der Sync-Historie" },
      { status: 500 }
    );
  }
}
