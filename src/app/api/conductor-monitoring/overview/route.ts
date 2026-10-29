import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findConductorWebsiteForDomain, getTechnicalSeoOverview } from "@/lib/conductor-data";

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
      return NextResponse.json({ overview: null });
    }

    const overview = await getTechnicalSeoOverview(website);
    return NextResponse.json({ overview });
  } catch (error) {
    console.error("[Conductor Overview]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Laden der Conductor-Daten" },
      { status: 500 }
    );
  }
}
