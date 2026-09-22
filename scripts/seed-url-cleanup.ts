import { config } from "dotenv";
config();

import {
  denormalizeAdobeOnInventory,
  seedAdobeFile,
  seedSitemaps,
  seedUrls,
  ADOBE_FILES,
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
  if (step === "denorm" || step === "all") {
    console.log("Adobe denorm…");
    console.log(await denormalizeAdobeOnInventory());
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
