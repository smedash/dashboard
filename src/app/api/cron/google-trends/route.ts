import { prisma } from "@/lib/prisma";
import { fetchGoogleTrends } from "@/lib/dataforseo";
import { sendGoogleTrendsCompletedNotification } from "@/lib/resend";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 600;
export const dynamic = "force-dynamic";

const BATCH_SIZE = 200;
const MAX_PROCESSING_MS = 500_000;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[Cron Google Trends] CRON_SECRET nicht konfiguriert");
      return NextResponse.json({ error: "CRON_SECRET nicht konfiguriert" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await prisma.googleTrendJob.findFirst({
      where: { status: { in: ["pending", "processing"] } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true } } },
    });

    if (!job) {
      return NextResponse.json({ message: "Keine offenen Jobs", processed: 0 });
    }

    if (job.status === "pending") {
      await prisma.googleTrendJob.update({
        where: { id: job.id },
        data: { status: "processing" },
      });
    }

    const allKeywords: string[] = JSON.parse(job.keywords);
    const startOffset = job.processedKeywords;
    const startTime = Date.now();
    let totalProcessedThisRun = 0;

    console.log(`[Cron Google Trends] Job ${job.id}: ${allKeywords.length} Keywords, Offset ${startOffset}`);

    for (let offset = startOffset; offset < allKeywords.length; offset += BATCH_SIZE) {
      if (Date.now() - startTime > MAX_PROCESSING_MS) {
        console.log(`[Cron Google Trends] Zeitlimit erreicht nach ${totalProcessedThisRun} Keywords`);
        break;
      }

      const batch = allKeywords.slice(offset, offset + BATCH_SIZE);

      const existingTrends = await prisma.googleTrend.findMany({
        where: {
          keyword: { in: batch },
          location: job.location,
          language: job.language,
          updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { keyword: true },
      });

      const existingSet = new Set(existingTrends.map((t) => t.keyword));
      const toFetch = batch.filter((k) => !existingSet.has(k));

      console.log(`[Cron Google Trends] Batch ${offset}-${offset + batch.length}: ${toFetch.length} neu, ${existingSet.size} gecacht`);

      if (toFetch.length > 0) {
        try {
          const results = await fetchGoogleTrends(toFetch, {
            location_name: job.location,
            language_name: job.language,
            concurrency: 20,
          });

          const validResults = results.filter((r) => r.trendAvg !== null || r.trendRecent !== null);
          const upsertBatch = validResults.map((r) =>
            prisma.googleTrend.upsert({
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
                trendAvg: r.trendAvg,
                trendRecent: r.trendRecent,
                trendDirection: r.trendDirection,
              },
              update: {
                trendAvg: r.trendAvg,
                trendRecent: r.trendRecent,
                trendDirection: r.trendDirection,
              },
            })
          );

          const UPSERT_CHUNK = 100;
          for (let u = 0; u < upsertBatch.length; u += UPSERT_CHUNK) {
            await Promise.all(upsertBatch.slice(u, u + UPSERT_CHUNK));
          }
        } catch (error) {
          console.error(`[Cron Google Trends] Fehler bei Batch ${offset}:`, error);
        }
      }

      totalProcessedThisRun += batch.length;

      await prisma.googleTrendJob.update({
        where: { id: job.id },
        data: { processedKeywords: offset + batch.length },
      });
    }

    const updatedJob = await prisma.googleTrendJob.findUnique({ where: { id: job.id } });
    const isComplete = updatedJob && updatedJob.processedKeywords >= allKeywords.length;

    if (isComplete) {
      await prisma.googleTrendJob.update({
        where: { id: job.id },
        data: { status: "completed" },
      });

      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
        await sendGoogleTrendsCompletedNotification({
          to: job.user.email,
          totalKeywords: job.totalKeywords,
          processedKeywords: updatedJob.processedKeywords,
          property: job.property,
          dashboardUrl: `${baseUrl}/queries`,
        });
        console.log(`[Cron Google Trends] Benachrichtigung gesendet an ${job.user.email}`);
      } catch (emailError) {
        console.error("[Cron Google Trends] E-Mail-Versand fehlgeschlagen:", emailError);
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Cron Google Trends] Run fertig: ${totalProcessedThisRun} verarbeitet in ${elapsed}s, Job ${isComplete ? "FERTIG" : "wird fortgesetzt"}`);

    return NextResponse.json({
      jobId: job.id,
      processedThisRun: totalProcessedThisRun,
      totalProcessed: updatedJob?.processedKeywords ?? 0,
      totalKeywords: allKeywords.length,
      isComplete,
      elapsedSeconds: elapsed,
    });
  } catch (error) {
    console.error("[Cron Google Trends] Fehler:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
