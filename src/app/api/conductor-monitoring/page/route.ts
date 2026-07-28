import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPageDetail, resolveWebsiteId } from "@/lib/conductor-monitoring";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const websiteId = searchParams.get("websiteId");

    if (!url) {
      return NextResponse.json(
        { error: "URL-Parameter ist erforderlich" },
        { status: 400 }
      );
    }

    const cId = websiteId || (await resolveWebsiteId());
    const result = await getPageDetail(cId, url);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Conductor Page Detail]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Abrufen der Seitendetails" },
      { status: 500 }
    );
  }
}
