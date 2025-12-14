import { auth } from "@/lib/auth";
import { getGSCProperties } from "@/lib/gsc";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const properties = await getGSCProperties(session.user.id);

    return NextResponse.json({ properties });
  } catch (error) {
    console.error("Error fetching GSC properties:", error);
    
    if (error instanceof Error && error.message === "No Google account connected") {
      return NextResponse.json(
        { error: "Google account not connected", needsConnection: true },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch properties" },
      { status: 500 }
    );
  }
}

