import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getWebsites } from "@/lib/conductor-monitoring";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const websites = await getWebsites();
    return NextResponse.json({ websites });
  } catch (error) {
    console.error("[Conductor Websites]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Abrufen der Websites" },
      { status: 500 }
    );
  }
}
