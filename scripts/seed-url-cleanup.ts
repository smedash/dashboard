import { config } from "dotenv";
config();

import {
  denormalizeAdobeOnInventory,
  denormalizeGatingOnInventory,
  denormalizeTimeSpentOnInventory,
  seedAdobeFile,
  seedGatingFile,
  seedSitemaps,
  seedTimeSpentFile,
  seedUrls,
  ADOBE_FILES,
  TIME_SPENT_FILES,
} from "../src/lib/url-cleanup/seed";
import { syncFocusKeywordsFromMapping, syncLabsFromCache } from "../src/lib/url-cleanup/keyword-join";
import { recomputeKillScores } from "../src/lib/url-cleanup/recompute";

const step = process.argv[2] || "all";

async function main() {
  if (step === "sitemaps" || step === "all") {
    console.log("Sitemaps…");
    console.log(await seedSitemaps());
  }
  if (step === "urls" || step === "all") {
    console.log("URLs…");
    console.log(await seedUrls());
  }
  if (step === "adobe" || step === "all") {
    for (const f of ADOBE_FILES) {
      console.log("Adobe", f.file);
      console.log(await seedAdobeFile(f.file));
    }
  }
  if (step === "timespent" || step === "all") {
    for (const f of TIME_SPENT_FILES) {
      console.log("Time spent", f.file);
      console.log(await seedTimeSpentFile(f.file));
    }
  }
  if (step === "gating" || step === "all") {
    console.log("Gating…");
    console.log(await seedGatingFile());
  }
  if (step === "denorm" || step === "all") {
    console.log("Adobe denorm…");
    console.log(await denormalizeAdobeOnInventory());
  }
  if (step === "denorm-timespent" || step === "all") {
    console.log("Time spent denorm…");
    console.log(await denormalizeTimeSpentOnInventory());
  }
  if (step === "denorm-gating" || step === "all") {
    console.log("Gating denorm…");
    console.log(await denormalizeGatingOnInventory());
  }
  if (step === "keywords" || step === "all") {
    console.log("Keywords…");
    console.log(await syncFocusKeywordsFromMapping());
    console.log(await syncLabsFromCache());
  }
  if (step === "scores" || step === "all") {
    console.log("Scores…");
    console.log(await recomputeKillScores());
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
