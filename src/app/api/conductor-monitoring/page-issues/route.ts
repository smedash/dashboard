import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasFullAdminRights } from "@/lib/rbac";
import { findConductorWebsiteForDomain } from "@/lib/conductor-data";
import { refreshPageIssues } from "@/lib/conductor-page-issues";

export const maxDuration = 300;

/** Short slices keep the UI responsive; the client calls again while pages are pending. */
const REFRESH_BUDGET_MS = 120_000;

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
    const domain = body.domain as string | undefined;
    if (!domain) {
      return NextResponse.json({ error: "domain Parameter fehlt" }, { status: 400 });
    }

    const website = await findConductorWebsiteForDomain(domain);
    if (!website?.lastSyncAt) {
      return NextResponse.json(
        { error: `Für "${domain}" gibt es noch keinen abgeschlossenen Conductor-Sync` },
        { status: 404 }
      );
    }

    const result = await refreshPageIssues(website, Date.now() + REFRESH_BUDGET_MS);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Conductor Page Issues]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Abgleich der URL-Issues fehlgeschlagen" },
      { status: 500 }
    );
  }
}
