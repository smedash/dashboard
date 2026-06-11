import { prisma } from "@/lib/prisma";
import { fetchSearchVolume } from "@/lib/dataforseo";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 600;
export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;
const MAX_PROCESSING_MS = 500_000;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[Cron Keyword Volume] CRON_SECRET nicht konfiguriert");
      return NextResponse.json({ error: "CRON_SECRET nicht konfiguriert" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await prisma.keywordVolumeJob.findFirst({
      where: { status: { in: ["pending", "processing"] } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true } } },
    });

    if (!job) {
      return NextResponse.json({ message: "Keine offenen Jobs", processed: 0 });
    }

    if (job.status === "pending") {
      await prisma.keywordVolumeJob.update({
        where: { id: job.id },
        data: { status: "processing" },
      });
    }

    const allKeywords: string[] = JSON.parse(job.keywords);
    const startOffset = job.processedKeywords;
    const startTime = Date.now();
    let totalProcessedThisRun = 0;

    console.log(`[Cron Keyword Volume] Job ${job.id}: ${allKeywords.length} Keywords, Offset ${startOffset}`);

    for (let offset = startOffset; offset < allKeywords.length; offset += BATCH_SIZE) {
      if (Date.now() - startTime > MAX_PROCESSING_MS) {
        console.log(`[Cron Keyword Volume] Zeitlimit erreicht nach ${totalProcessedThisRun} Keywords`);
        break;
      }

      const batch = allKeywords.slice(offset, offset + BATCH_SIZE);

      // Skip keywords cached within last 30 days
      const existingVolumes = await prisma.keywordVolume.findMany({
        where: {
          keyword: { in: batch },
          location: job.location,
          language: job.language,
          updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { keyword: true },
      });

      const existingSet = new Set(existingVolumes.map((v) => v.keyword));
      const toFetch = batch.filter((k) => !existingSet.has(k));

      console.log(`[Cron Keyword Volume] Batch ${offset}-${offset + batch.length}: ${toFetch.length} neu, ${existingSet.size} gecacht`);

      if (toFetch.length > 0) {
        try {
          const results = await fetchSearchVolume(toFetch, job.location, job.language);

          const upsertBatch = results.map((r) =>
            prisma.keywordVolume.upsert({
              where: {
                keyword_location_language: {
                  keyword: r.keyword.toLowerCase(),
                  location: job.location,
                  language: job.language,
                },
              },
              create: {
                keyword: r.keyword.toLowerCase(),
                location: job.location,
                language: job.language,
                searchVolume: r.search_volume,
                cpc: r.cpc,
                competition: r.competition,
                competitionIndex: r.competition_index,
                lowTopOfPageBid: r.low_top_of_page_bid,
                highTopOfPageBid: r.high_top_of_page_bid,
              },
              update: {
                searchVolume: r.search_volume,
                cpc: r.cpc,
                competition: r.competition,
                competitionIndex: r.competition_index,
                lowTopOfPageBid: r.low_top_of_page_bid,
                highTopOfPageBid: r.high_top_of_page_bid,
              },
            })
          );

          const UPSERT_CHUNK = 100;
          for (let u = 0; u < upsertBatch.length; u += UPSERT_CHUNK) {
            await Promise.all(upsertBatch.slice(u, u + UPSERT_CHUNK));
          }
        } catch (error) {
          console.error(`[Cron Keyword Volume] Fehler bei Batch ${offset}:`, error);
        }
      }

      totalProcessedThisRun += batch.length;

      await prisma.keywordVolumeJob.update({
        where: { id: job.id },
        data: { processedKeywords: offset + batch.length },
      });
    }

    const updatedJob = await prisma.keywordVolumeJob.findUnique({ where: { id: job.id } });
    const isComplete = updatedJob && updatedJob.processedKeywords >= allKeywords.length;

    if (isComplete) {
      await prisma.keywordVolumeJob.update({
        where: { id: job.id },
        data: { status: "completed" },
      });
      console.log(`[Cron Keyword Volume] Job ${job.id} abgeschlossen`);
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Cron Keyword Volume] Run fertig: ${totalProcessedThisRun} verarbeitet in ${elapsed}s, Job ${isComplete ? "FERTIG" : "wird fortgesetzt"}`);

    return NextResponse.json({
      jobId: job.id,
      processedThisRun: totalProcessedThisRun,
      totalProcessed: updatedJob?.processedKeywords ?? 0,
      totalKeywords: allKeywords.length,
      isComplete,
      elapsedSeconds: elapsed,
    });
  } catch (error) {
    console.error("[Cron Keyword Volume] Fehler:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
