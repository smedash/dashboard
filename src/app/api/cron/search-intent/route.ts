import { prisma } from "@/lib/prisma";
import { fetchSearchIntent } from "@/lib/dataforseo";
import { sendSearchIntentCompletedNotification } from "@/lib/resend";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BATCH_SIZE = 1000;
const MAX_PROCESSING_MS = 250_000;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[Cron Search Intent] CRON_SECRET nicht konfiguriert");
      return NextResponse.json({ error: "CRON_SECRET nicht konfiguriert" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await prisma.searchIntentJob.findFirst({
      where: { status: { in: ["pending", "processing"] } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true, name: true } } },
    });

    if (!job) {
      return NextResponse.json({ message: "Keine offenen Jobs", processed: 0 });
    }

    if (job.status === "pending") {
      await prisma.searchIntentJob.update({
        where: { id: job.id },
        data: { status: "processing" },
      });
    }

    const allKeywords: string[] = JSON.parse(job.keywords);
    const startOffset = job.processedKeywords;
    const startTime = Date.now();
    let totalProcessedThisRun = 0;

    console.log(`[Cron Search Intent] Job ${job.id}: ${allKeywords.length} Keywords, Offset ${startOffset}`);

    for (let offset = startOffset; offset < allKeywords.length; offset += BATCH_SIZE) {
      if (Date.now() - startTime > MAX_PROCESSING_MS) {
        console.log(`[Cron Search Intent] Zeitlimit erreicht nach ${totalProcessedThisRun} Keywords`);
        break;
      }

      const batch = allKeywords.slice(offset, offset + BATCH_SIZE);

      const existingIntents = await prisma.searchIntent.findMany({
        where: {
          keyword: { in: batch },
          language: job.language,
          updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { keyword: true },
      });

      const existingSet = new Set(existingIntents.map((t) => t.keyword));
      const toFetch = batch.filter((k) => !existingSet.has(k));

      console.log(`[Cron Search Intent] Batch ${offset}-${offset + batch.length}: ${toFetch.length} neu, ${existingSet.size} gecacht`);

      if (toFetch.length > 0) {
        try {
          const results = await fetchSearchIntent(toFetch, {
            language_code: job.language,
          });

          for (const r of results) {
            await prisma.searchIntent.upsert({
              where: {
                keyword_language: {
                  keyword: r.keyword.toLowerCase(),
                  language: job.language,
                },
              },
              create: {
                keyword: r.keyword.toLowerCase(),
                language: job.language,
                intentLabel: r.intentLabel,
                intentProbability: r.intentProbability,
                secondaryIntents: r.secondaryIntents
                  ? JSON.stringify(r.secondaryIntents)
                  : null,
              },
              update: {
                intentLabel: r.intentLabel,
                intentProbability: r.intentProbability,
                secondaryIntents: r.secondaryIntents
                  ? JSON.stringify(r.secondaryIntents)
                  : null,
              },
            });
          }
        } catch (error) {
          console.error(`[Cron Search Intent] Fehler bei Batch ${offset}:`, error);
        }
      }

      totalProcessedThisRun += batch.length;

      await prisma.searchIntentJob.update({
        where: { id: job.id },
        data: { processedKeywords: offset + batch.length },
      });
    }

    const updatedJob = await prisma.searchIntentJob.findUnique({ where: { id: job.id } });
    const isComplete = updatedJob && updatedJob.processedKeywords >= allKeywords.length;

    if (isComplete) {
      await prisma.searchIntentJob.update({
        where: { id: job.id },
        data: { status: "completed" },
      });

      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
        await sendSearchIntentCompletedNotification({
          to: job.user.email,
          totalKeywords: job.totalKeywords,
          processedKeywords: updatedJob.processedKeywords,
          property: job.property,
          dashboardUrl: `${baseUrl}/queries`,
        });
        console.log(`[Cron Search Intent] Benachrichtigung gesendet an ${job.user.email}`);
      } catch (emailError) {
        console.error("[Cron Search Intent] E-Mail-Versand fehlgeschlagen:", emailError);
      }

      console.log(`[Cron Search Intent] Job ${job.id} abgeschlossen`);
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Cron Search Intent] Run fertig: ${totalProcessedThisRun} verarbeitet in ${elapsed}s, Job ${isComplete ? "FERTIG" : "wird fortgesetzt"}`);

    return NextResponse.json({
      jobId: job.id,
      processedThisRun: totalProcessedThisRun,
      totalProcessed: updatedJob?.processedKeywords ?? 0,
      totalKeywords: allKeywords.length,
      isComplete,
      elapsedSeconds: elapsed,
    });
  } catch (error) {
    console.error("[Cron Search Intent] Fehler:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
