#!/usr/bin/env node
/**
 * Probes the Conductor Reporting API to find out whether page-level issue data
 * is available in the bulk pages endpoint or only via the page detail endpoint.
 *
 * Usage: node scripts/conductor-probe.mjs [domain-filter]
 */

import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const TOKEN = process.env.CONDUCTOR_REPORTING_TOKEN;
if (!TOKEN) {
  console.error("CONDUCTOR_REPORTING_TOKEN fehlt in .env / .env.local");
  process.exit(1);
}

const BASE_URL = "https://api.cm.conductor.com";
const ISSUE_KEY_PATTERN = /issue|problem|error|warning/i;

async function api(path) {
  await new Promise((r) => setTimeout(r, 200));
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `token ${TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`${path} → ${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res.json();
}

function section(title) {
  console.log(`\n=== ${title} ${"=".repeat(Math.max(0, 70 - title.length))}`);
}

const domainFilter = process.argv[2]?.toLowerCase();

section("Websites");
const { data: websites } = await api("/v2/entities/websites");
for (const w of websites) console.log(`${w.id.padEnd(12)} ${w.domain}`);

const website = domainFilter
  ? websites.find((w) => w.domain.toLowerCase().includes(domainFilter))
  : websites[0];
if (!website) {
  console.error(`Keine Website passt zu "${domainFilter}"`);
  process.exit(1);
}
console.log(`\n→ verwende ${website.id} (${website.domain})`);

section("Bulk-Endpunkt /v2/data/pages");
const pagesRes = await api(
  `/v2/data/pages?website_id=${encodeURIComponent(website.id)}&per_page=50`
);
const pages = pagesRes.data.urls;
console.log(`${pages.length} Seiten geladen (total: ${pagesRes.data.total})`);

const allKeys = [...new Set(pages.flatMap((p) => Object.keys(p)))].sort();
console.log(`\nFelder (${allKeys.length}):`);
for (const key of allKeys) {
  console.log(`  ${ISSUE_KEY_PATTERN.test(key) ? "★" : " "} ${key}`);
}

const issueKeys = allKeys.filter((k) => ISSUE_KEY_PATTERN.test(k));
if (issueKeys.length > 0) {
  console.log("\nIssue-verdächtige Felder, Beispielwerte:");
  for (const key of issueKeys) {
    const sample = pages.find((p) => p[key] != null)?.[key];
    console.log(`  ${key}:`, JSON.stringify(sample, null, 2)?.slice(0, 1000));
  }
} else {
  console.log("\n→ Keine Issue-Felder im Bulk-Endpunkt gefunden.");
}

section("Detail-Endpunkt /v2/data/page");
const candidates = pages
  .filter((p) => p.type === "page" && typeof p.health === "number" && p.health < 1000)
  .sort((a, b) => a.health - b.health)
  .slice(0, 3);

if (candidates.length === 0) {
  console.log("Keine Seite mit health < 1000 in der Stichprobe gefunden.");
}

for (const page of candidates) {
  const detail = await api(
    `/v2/data/page?website_id=${encodeURIComponent(website.id)}&url=${encodeURIComponent(page.url)}`
  );
  const openIssues = detail.data.open_issues ?? [];
  console.log(`\n${page.url}`);
  console.log(`  health: ${page.health}, open_issues: ${openIssues.length}`);
  for (const issue of openIssues) console.log(`   - ${JSON.stringify(issue)}`);
}

section("Fazit");
console.log(
  issueKeys.length > 0
    ? "Bulk-Endpunkt enthält Issue-Felder → Zuordnung kann im bestehenden Sync mitlaufen."
    : `Nur Detail-Endpunkt liefert Issues → ${pagesRes.data.total} URLs bei ~5 req/s ≈ ${Math.ceil(
        pagesRes.data.total / 5 / 60
      )} Minuten Sync-Zeit (weniger, wenn nur health < 1000 abgefragt wird).`
);
