import { prisma } from "@/lib/prisma";
import { getGSCSearchAnalytics, getDateRange } from "@/lib/gsc";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 600;
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25000;
const MAX_PAGES = 4;
const MAX_PROCESSING_MS = 500_000;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[Cron Keyword URLs] CRON_SECRET nicht konfiguriert");
      return NextResponse.json({ error: "CRON_SECRET nicht konfiguriert" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await prisma.keywordUrlJob.findFirst({
      where: { status: { in: ["pending", "processing"] } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true, id: true } } },
    });

    if (!job) {
      return NextResponse.json({ message: "Keine offenen Jobs", processed: 0 });
    }

    if (job.status === "pending") {
      await prisma.keywordUrlJob.update({
        where: { id: job.id },
        data: { status: "processing" },
      });
    }

    const startTime = Date.now();
    const { startDate, endDate } = getDateRange(job.period);

    console.log(`[Cron Keyword URLs] Job ${job.id}: Fetching query+page data for ${job.property}, period ${job.period}`);

    const allRows: Array<{ keyword: string; url: string; clicks: number; impressions: number; ctr: number; position: number }> = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      if (Date.now() - startTime > MAX_PROCESSING_MS) {
        console.log(`[Cron Keyword URLs] Zeitlimit erreicht bei Seite ${page}`);
        break;
      }

      const startRow = page * PAGE_SIZE;

      try {
        const result = await getGSCSearchAnalytics(job.user.id, job.property, {
          startDate,
          endDate,
          dimensions: ["query", "page"],
          rowLimit: PAGE_SIZE,
          startRow,
        });

        if (!result.rows || result.rows.length === 0) {
          console.log(`[Cron Keyword URLs] Seite ${page}: keine weiteren Daten (startRow=${startRow})`);
          break;
        }

        for (const row of result.rows) {
          allRows.push({
            keyword: row.keys[0].toLowerCase().trim(),
            url: row.keys[1],
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          });
        }

        console.log(`[Cron Keyword URLs] Seite ${page}: ${result.rows.length} Zeilen geladen (gesamt: ${allRows.length})`);

        if (result.rows.length < PAGE_SIZE) {
          break;
        }
      } catch (error) {
        console.error(`[Cron Keyword URLs] Fehler bei Seite ${page}:`, error);
        break;
      }
    }

    if (allRows.length === 0) {
      await prisma.keywordUrlJob.update({
        where: { id: job.id },
        data: { status: "failed", error: "Keine Daten von GSC erhalten" },
      });
      return NextResponse.json({ error: "Keine Daten erhalten", jobId: job.id });
    }

    console.log(`[Cron Keyword URLs] ${allRows.length} Zeilen geladen, speichere in DB...`);

    await prisma.keywordUrl.deleteMany({
      where: { property: job.property, period: job.period },
    });

    const UPSERT_CHUNK = 100;
    let stored = 0;

    for (let i = 0; i < allRows.length; i += UPSERT_CHUNK) {
      if (Date.now() - startTime > MAX_PROCESSING_MS) {
        console.log(`[Cron Keyword URLs] Zeitlimit beim Speichern erreicht nach ${stored} Zeilen`);
        break;
      }

      const chunk = allRows.slice(i, i + UPSERT_CHUNK);

      await prisma.keywordUrl.createMany({
        data: chunk.map((row) => ({
          keyword: row.keyword,
          url: row.url,
          property: job.property,
          period: job.period,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        })),
        skipDuplicates: true,
      });

      stored += chunk.length;

      if (i % 1000 === 0) {
        await prisma.keywordUrlJob.update({
          where: { id: job.id },
          data: { processedKeywords: stored },
        });
      }
    }

    const uniqueKeywords = new Set(allRows.map((r) => r.keyword));

    await prisma.keywordUrlJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        totalKeywords: uniqueKeywords.size,
        processedKeywords: stored,
      },
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Cron Keyword URLs] Job ${job.id} abgeschlossen: ${stored} URL-Mappings fuer ${uniqueKeywords.size} Keywords in ${elapsed}s`);

    return NextResponse.json({
      jobId: job.id,
      totalRows: allRows.length,
      uniqueKeywords: uniqueKeywords.size,
      stored,
      elapsedSeconds: elapsed,
    });
  } catch (error) {
    console.error("[Cron Keyword URLs] Fehler:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
