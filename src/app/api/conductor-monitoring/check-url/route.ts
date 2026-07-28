import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkUrl } from "@/lib/conductor-monitoring";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const url = body.url as string;

    if (!url) {
      return NextResponse.json(
        { error: "URL ist erforderlich" },
        { status: 400 }
      );
    }

    const result = await checkUrl(url);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Conductor Check URL]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Check-URL fehlgeschlagen" },
      { status: 500 }
    );
  }
}
