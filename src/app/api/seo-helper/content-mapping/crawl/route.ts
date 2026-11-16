import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/keyword-map/server";
import { countPending, crawlContentBatch, crawlInventoryUrl, type CrawlScope } from "@/lib/content-mapping/crawl";

export const maxDuration = 300;

/** Neue URLs werden nur bis hierhin begonnen; einzelne Abrufe inkl. DataForSEO-Fallback können ~140 s dauern. */
const START_BUDGET_MS = 140_000;

function scopeFrom(value: unknown): CrawlScope {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const str = (k: string) => (typeof v[k] === "string" && (v[k] as string).trim() ? (v[k] as string).trim() : undefined);
  return { q: str("q"), country: str("country"), language: str("language"), section: str("section") };
}

/** Vorschau: wie viele URLs ein Lauf crawlen würde. */
export async function GET(request: NextRequest) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const force = sp.get("force") === "1" || sp.get("force") === "true";
  const scope = scopeFrom(Object.fromEntries(sp.entries()));
  try {
    const pending = await countPending({ force, startedAt: new Date(), scope });
    return NextResponse.json({ pending });
  } catch (e) {
    console.error("[content-mapping/crawl] GET", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Vorschau fehlgeschlagen" }, { status: 500 });
  }
}

/**
 * Ein Schritt des Crawl-Laufs. Der Browser ruft das wiederholt auf, bis `done` true ist.
 * Mit `inventoryId` wird genau diese URL neu gecrawlt.
 */
export async function POST(request: NextRequest) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      inventoryId?: string;
      force?: boolean;
      startedAt?: string;
      scope?: unknown;
    };

    if (typeof body.inventoryId === "string" && body.inventoryId) {
      const row = await prisma.urlInventory.findUnique({ where: { id: body.inventoryId }, select: { id: true, url: true } });
      if (!row) return NextResponse.json({ error: "URL nicht gefunden" }, { status: 404 });
      return NextResponse.json(await crawlInventoryUrl(row.id, row.url));
    }

    const startedAt = new Date(body.startedAt ?? "");
    if (Number.isNaN(startedAt.getTime())) {
      return NextResponse.json({ error: "startedAt fehlt" }, { status: 400 });
    }
    const step = await crawlContentBatch({
      force: body.force === true,
      startedAt,
      scope: scopeFrom(body.scope),
      limit: 60,
      concurrency: 6,
      startDeadline: Date.now() + START_BUDGET_MS,
    });
    return NextResponse.json(step);
  } catch (e) {
    console.error("[content-mapping/crawl] POST", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Crawl konnte nicht fortgesetzt werden" }, { status: 500 });
  }
}
