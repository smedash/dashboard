import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasFullAdminRights } from "@/lib/rbac";
import { syncConductorData, findConductorWebsiteByDomain } from "@/lib/conductor-sync";

export const maxDuration = 800;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasFullAdminRights(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const websiteId = body.websiteId as string | undefined;
    const domain = body.domain as string | undefined;

    let targetWebsiteId = websiteId;

    if (!targetWebsiteId && domain) {
      targetWebsiteId = await findConductorWebsiteByDomain(domain);
      if (!targetWebsiteId) {
        return NextResponse.json(
          { error: `Keine Conductor-Website fuer Domain "${domain}" gefunden` },
          { status: 404 }
        );
      }
    }

    if (!targetWebsiteId) {
      return NextResponse.json(
        { error: "Bitte Property auswaehlen (domain Parameter fehlt)" },
        { status: 400 }
      );
    }

    const result = await syncConductorData("manual", targetWebsiteId);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[Conductor Sync]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync fehlgeschlagen" },
      { status: 500 }
    );
  }
}
