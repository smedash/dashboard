import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasFullAdminRights } from "@/lib/rbac";
import { syncConductorWebsite, findConductorWebsiteByDomain } from "@/lib/conductor-sync";
import { getWebsites } from "@/lib/conductor-monitoring";

export const maxDuration = 800;

/** Short slices keep the UI responsive; the client calls again while the run is "paused". */
const SYNC_BUDGET_MS = 240_000;

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

    const website = websiteId
      ? (await getWebsites()).find((w) => w.id === websiteId)
      : domain
        ? await findConductorWebsiteByDomain(domain)
        : undefined;

    if (!website) {
      if (!websiteId && !domain) {
        return NextResponse.json(
          { error: "Bitte Property auswaehlen (domain Parameter fehlt)" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `Keine Conductor-Website fuer "${websiteId ?? domain}" gefunden` },
        { status: 404 }
      );
    }

    const result = await syncConductorWebsite(website, "manual", Date.now() + SYNC_BUDGET_MS);
    return NextResponse.json({
      success: result.status !== "locked",
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
