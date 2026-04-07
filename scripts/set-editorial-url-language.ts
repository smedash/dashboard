// Usage: npx tsx scripts/set-editorial-url-language.ts [--dry-run]
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { languageFromUrlPath } from "../src/lib/url-language";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();

  try {
    const articles = await prisma.editorialPlanArticle.findMany({
      select: { id: true, url: true, language: true },
    });

    console.log(`Artikel gesamt: ${articles.length}`);
    console.log(`Modus: ${dryRun ? "DRY RUN (keine DB-Änderung)" : "LIVE"}\n`);

    let updated = 0;
    let cleared = 0;
    let unchanged = 0;
    const samples: string[] = [];

    for (const a of articles) {
      const derived = languageFromUrlPath(a.url);
      const prev = a.language;

      if (derived === prev) {
        unchanged++;
        continue;
      }

      if (samples.length < 25) {
        const urlShort = a.url && a.url.length > 72 ? `${a.url.slice(0, 72)}…` : a.url || "(keine URL)";
        samples.push(`  ${urlShort}\n    Sprache: ${prev ?? "—"} → ${derived ?? "—"}`);
      }

      if (!dryRun) {
        await prisma.editorialPlanArticle.update({
          where: { id: a.id },
          data: { language: derived },
        });
      }

      if (derived === null && prev != null) cleared++;
      else updated++;
    }

    if (samples.length > 0) {
      console.log("Beispiele:\n");
      for (const s of samples) {
        console.log(s);
        console.log();
      }
    }

    console.log("--- Zusammenfassung ---");
    console.log(`Unverändert: ${unchanged}`);
    console.log(`Neu gesetzt / geändert: ${updated}`);
    console.log(`Sprache entfernt (kein zweites Segment): ${cleared}`);
    if (dryRun) {
      console.log("\nDry-Run beendet. Ohne --dry-run ausführen, um die Datenbank zu aktualisieren.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fehler:", err);
  process.exit(1);
});
