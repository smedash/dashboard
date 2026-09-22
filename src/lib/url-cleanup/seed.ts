import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import { ADOBE_FILES } from "./adobe-files";
import { prisma } from "@/lib/prisma";
import { canonicalUbsUrl, lookupInventoryId, toUrlKey } from "./normalize";
import { parseUbsPath } from "./parse-path";

export { ADOBE_FILES } from "./adobe-files";

export const ADOBE_PERIOD = {
  start: new Date("2025-09-21T00:00:00.000Z"),
  end: new Date("2026-09-21T00:00:00.000Z"),
};

const DATA_DIR = path.join(process.cwd(), "public", "data");

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v && "text" in (v as { text?: string })) {
    return String((v as { text?: string }).text ?? "");
  }
  if (typeof v === "object" && v && "result" in (v as { result?: unknown })) {
    return cellStr((v as { result?: unknown }).result);
  }
  return String(v).trim();
}

function cellNum(v: unknown): number {
  const n = Number(cellStr(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const s = cellStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function readSheetRows(filePath: string): Promise<{ headers: string[]; rows: unknown[][] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellStr(cell.value);
  });
  const rows: unknown[][] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const vals: unknown[] = [];
    for (let i = 0; i < headers.length; i++) {
      vals[i] = row.getCell(i + 1).value;
    }
    rows.push(vals);
  });
  return { headers, rows };
}

function colIndex(headers: string[], ...candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const i = lower.findIndex((h) => h === c.toLowerCase() || h.includes(c.toLowerCase()));
    if (i >= 0) return i;
  }
  return -1;
}

export async function seedSitemaps(): Promise<{ count: number }> {
  const filePath = path.join(DATA_DIR, "ubs_sitemaps.xlsx");
  if (!fs.existsSync(filePath)) throw new Error("ubs_sitemaps.xlsx nicht gefunden");
  const { headers, rows } = await readSheetRows(filePath);
  const iUrl = colIndex(headers, "Sitemap-URL", "sitemap");
  const iCountry = colIndex(headers, "Land");
  const iLang = colIndex(headers, "Sprache");
  const iNr = colIndex(headers, "Nr.");
  if (iUrl < 0) throw new Error("Sitemap-URL-Spalte fehlt");

  const records = rows
    .map((r) => {
      const sitemapUrl = cellStr(r[iUrl]);
      if (!sitemapUrl) return null;
      return {
        sitemapUrl,
        countryPath: iCountry >= 0 ? cellStr(r[iCountry]) || null : null,
        language: iLang >= 0 ? cellStr(r[iLang]) || null : null,
        number: iNr >= 0 ? cellNum(r[iNr]) || null : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  for (const rec of records) {
    await prisma.urlSitemap.upsert({
      where: { sitemapUrl: rec.sitemapUrl },
      update: {
        countryPath: rec.countryPath,
        language: rec.language,
        number: rec.number,
      },
      create: rec,
    });
  }
  return { count: records.length };
}

type InvAgg = {
  url: string;
  urlKey: string;
  urlKeyNoHtml: string;
  lastmod: Date | null;
  newsPublicationDate: Date | null;
  newsTitle: string | null;
  hreflangs: unknown;
  sitemapUrls: Set<string>;
};

export async function seedUrls(): Promise<{ unique: number; rows: number; sitemapLinks: number }> {
  const filePath = path.join(DATA_DIR, "ubs_urls.xlsx");
  if (!fs.existsSync(filePath)) throw new Error("ubs_urls.xlsx nicht gefunden");
  const { headers, rows } = await readSheetRows(filePath);
  const iUrl = colIndex(headers, "url");
  const iSitemap = colIndex(headers, "sitemap");
  const iLastmod = colIndex(headers, "lastmod");
  const iNewsDate = colIndex(headers, "news_publication_date");
  const iNewsTitle = colIndex(headers, "news_title");
  const iHreflangs = colIndex(headers, "hreflangs");
  if (iUrl < 0) throw new Error("url-Spalte fehlt");

  const byKey = new Map<string, InvAgg>();
  for (const r of rows) {
    const raw = cellStr(r[iUrl]);
    const keys = toUrlKey(raw);
    if (!keys) continue;
    const sitemapUrl = iSitemap >= 0 ? cellStr(r[iSitemap]) : "";
    const lastmod = iLastmod >= 0 ? parseDate(r[iLastmod]) : null;
    const existing = byKey.get(keys.urlKey);
    if (!existing) {
      let hreflangs: unknown = null;
      if (iHreflangs >= 0) {
        const hs = cellStr(r[iHreflangs]);
        if (hs) {
          try {
            hreflangs = JSON.parse(hs);
          } catch {
            hreflangs = hs;
          }
        }
      }
      byKey.set(keys.urlKey, {
        url: raw.startsWith("http") ? raw : canonicalUbsUrl(keys.urlKey),
        urlKey: keys.urlKey,
        urlKeyNoHtml: keys.urlKeyNoHtml,
        lastmod,
        newsPublicationDate: iNewsDate >= 0 ? parseDate(r[iNewsDate]) : null,
        newsTitle: iNewsTitle >= 0 ? cellStr(r[iNewsTitle]) || null : null,
        hreflangs,
        sitemapUrls: new Set(sitemapUrl ? [sitemapUrl] : []),
      });
    } else {
      if (sitemapUrl) existing.sitemapUrls.add(sitemapUrl);
      if (lastmod && (!existing.lastmod || lastmod > existing.lastmod)) {
        existing.lastmod = lastmod;
      }
    }
  }

  const sitemaps = await prisma.urlSitemap.findMany({ select: { id: true, sitemapUrl: true } });
  const sitemapIdByUrl = new Map(sitemaps.map((s) => [s.sitemapUrl, s.id]));

  const values = [...byKey.values()];
  const CREATE_BATCH = 800;
  for (let i = 0; i < values.length; i += CREATE_BATCH) {
    const slice = values.slice(i, i + CREATE_BATCH).map((v) => {
      const parsed = parseUbsPath(v.urlKey);
      return {
        url: v.url,
        urlKey: v.urlKey,
        urlKeyNoHtml: v.urlKeyNoHtml,
        country: parsed.country,
        language: parsed.language,
        section: parsed.section,
        pathDepth: parsed.pathDepth,
        lastmod: v.lastmod,
        newsPublicationDate: v.newsPublicationDate,
        newsTitle: v.newsTitle,
        hreflangs: v.hreflangs === null ? undefined : (v.hreflangs as object),
      };
    });
    await prisma.urlInventory.createMany({ data: slice, skipDuplicates: true });
  }

  const invRows = await prisma.urlInventory.findMany({ select: { id: true, urlKey: true } });
  const idByKey = new Map(invRows.map((r) => [r.urlKey, r.id]));

  const joins: { inventoryId: string; sitemapId: string }[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const inventoryId = idByKey.get(v.urlKey);
    if (!inventoryId) continue;
    for (const su of v.sitemapUrls) {
      const sitemapId = sitemapIdByUrl.get(su);
      if (!sitemapId) continue;
      const k = `${inventoryId}:${sitemapId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      joins.push({ inventoryId, sitemapId });
    }
  }

  for (let i = 0; i < joins.length; i += CREATE_BATCH) {
    await prisma.urlInventorySitemap.createMany({
      data: joins.slice(i, i + CREATE_BATCH),
      skipDuplicates: true,
    });
  }

  return { unique: values.length, rows: rows.length, sitemapLinks: joins.length };
}

type AdobeAgg = {
  inventoryId: string;
  pageViews: number;
  visits: number;
  uniqueVisitors: number;
  formStart: number;
  formSuccess: number;
};

async function loadInventoryLookup(): Promise<{
  byKey: Map<string, string>;
  byNoHtml: Map<string, string>;
}> {
  const rows = await prisma.urlInventory.findMany({
    select: { id: true, urlKey: true, urlKeyNoHtml: true },
  });
  const byKey = new Map<string, string>();
  const byNoHtml = new Map<string, string>();
  for (const r of rows) {
    byKey.set(r.urlKey, r.id);
    if (!byNoHtml.has(r.urlKeyNoHtml)) byNoHtml.set(r.urlKeyNoHtml, r.id);
  }
  return { byKey, byNoHtml };
}

export async function seedAdobeFile(fileName: string): Promise<{
  slug: string;
  matched: number;
  unmatched: number;
}> {
  const spec = ADOBE_FILES.find((f) => f.file === fileName);
  if (!spec) throw new Error(`Unbekannte Adobe-Datei: ${fileName}`);
  const filePath = path.join(DATA_DIR, spec.file);
  if (!fs.existsSync(filePath)) throw new Error(`${spec.file} nicht gefunden`);

  const { byKey, byNoHtml } = await loadInventoryLookup();
  const { headers, rows } = await readSheetRows(filePath);

  const merged = new Map<string, AdobeAgg>();
  const unmatchedSample: string[] = [];
  let unmatched = 0;

  if (spec.kind === "traffic") {
    const iPage = colIndex(headers, "Pages", "Page");
    const iPv = colIndex(headers, "Page Views");
    const iVisits = colIndex(headers, "Visits");
    const iUv = colIndex(headers, "Unique Visitors");
    if (iPage < 0) throw new Error("Pages-Spalte fehlt");
    for (const r of rows) {
      const raw = cellStr(r[iPage]);
      const keys = toUrlKey(raw);
      if (!keys) {
        unmatched++;
        if (unmatchedSample.length < 30) unmatchedSample.push(raw);
        continue;
      }
      const inventoryId = lookupInventoryId(keys, byKey, byNoHtml);
      if (!inventoryId) {
        unmatched++;
        if (unmatchedSample.length < 30) unmatchedSample.push(raw);
        continue;
      }
      const prev = merged.get(inventoryId) ?? {
        inventoryId,
        pageViews: 0,
        visits: 0,
        uniqueVisitors: 0,
        formStart: 0,
        formSuccess: 0,
      };
      prev.pageViews += iPv >= 0 ? cellNum(r[iPv]) : 0;
      prev.visits += iVisits >= 0 ? cellNum(r[iVisits]) : 0;
      prev.uniqueVisitors += iUv >= 0 ? cellNum(r[iUv]) : 0;
      merged.set(inventoryId, prev);
    }
  } else {
    const iPath = colIndex(headers, "Page Path", "evar4");
    const iStart = colIndex(headers, "Form Start", "event13");
    const iSuccess = colIndex(headers, "Form Success", "event14");
    if (iPath < 0) throw new Error("Page Path-Spalte fehlt");
    for (const r of rows) {
      const raw = cellStr(r[iPath]);
      const keys = toUrlKey(raw);
      if (!keys) {
        unmatched++;
        if (unmatchedSample.length < 30) unmatchedSample.push(raw);
        continue;
      }
      const inventoryId = lookupInventoryId(keys, byKey, byNoHtml);
      if (!inventoryId) {
        unmatched++;
        if (unmatchedSample.length < 30) unmatchedSample.push(raw);
        continue;
      }
      const prev = merged.get(inventoryId) ?? {
        inventoryId,
        pageViews: 0,
        visits: 0,
        uniqueVisitors: 0,
        formStart: 0,
        formSuccess: 0,
      };
      prev.formStart += iStart >= 0 ? cellNum(r[iStart]) : 0;
      prev.formSuccess += iSuccess >= 0 ? cellNum(r[iSuccess]) : 0;
      merged.set(inventoryId, prev);
    }
  }

  const dimension = await prisma.urlDimension.upsert({
    where: { slug: spec.slug },
    update: {
      name: spec.name,
      sourceType: "adobe",
      segment: spec.segment,
      periodStart: ADOBE_PERIOD.start,
      periodEnd: ADOBE_PERIOD.end,
      columns:
        spec.kind === "traffic"
          ? [
              { key: "pageViews", label: "Page Views", type: "number" },
              { key: "visits", label: "Visits", type: "number" },
              { key: "uniqueVisitors", label: "Unique Visitors", type: "number" },
            ]
          : [
              { key: "formStart", label: "Form Start", type: "number" },
              { key: "formSuccess", label: "Form Success", type: "number" },
            ],
      matchedCount: merged.size,
      unmatchedCount: unmatched,
      unmatchedSample,
      importedAt: new Date(),
    },
    create: {
      slug: spec.slug,
      name: spec.name,
      sourceType: "adobe",
      segment: spec.segment,
      periodStart: ADOBE_PERIOD.start,
      periodEnd: ADOBE_PERIOD.end,
      columns:
        spec.kind === "traffic"
          ? [
              { key: "pageViews", label: "Page Views", type: "number" },
              { key: "visits", label: "Visits", type: "number" },
              { key: "uniqueVisitors", label: "Unique Visitors", type: "number" },
            ]
          : [
              { key: "formStart", label: "Form Start", type: "number" },
              { key: "formSuccess", label: "Form Success", type: "number" },
            ],
      matchedCount: merged.size,
      unmatchedCount: unmatched,
      unmatchedSample,
    },
  });

  await prisma.urlDimensionValue.deleteMany({ where: { dimensionId: dimension.id } });

  const valueRows = [...merged.values()].map((m) => ({
    inventoryId: m.inventoryId,
    dimensionId: dimension.id,
    values:
      spec.kind === "traffic"
        ? { pageViews: m.pageViews, visits: m.visits, uniqueVisitors: m.uniqueVisitors }
        : { formStart: m.formStart, formSuccess: m.formSuccess },
  }));

  const CREATE_BATCH = 500;
  for (let i = 0; i < valueRows.length; i += CREATE_BATCH) {
    await prisma.urlDimensionValue.createMany({ data: valueRows.slice(i, i + CREATE_BATCH) });
  }

  return { slug: spec.slug, matched: merged.size, unmatched };
}

export async function denormalizeAdobeOnInventory(): Promise<{ updated: number }> {
  const dims = await prisma.urlDimension.findMany({
    where: { sourceType: "adobe" },
    include: { values: true },
  });

  type Acc = {
    pageViews: number;
    visits: number;
    uniqueVisitors: number;
    formStart: number;
    formSuccess: number;
    segments: Set<string>;
    has: boolean;
  };
  const acc = new Map<string, Acc>();

  for (const dim of dims) {
    for (const val of dim.values) {
      const v = (val.values ?? {}) as Record<string, number>;
      const cur = acc.get(val.inventoryId) ?? {
        pageViews: 0,
        visits: 0,
        uniqueVisitors: 0,
        formStart: 0,
        formSuccess: 0,
        segments: new Set<string>(),
        has: false,
      };
      cur.pageViews = Math.max(cur.pageViews, v.pageViews ?? 0);
      cur.visits = Math.max(cur.visits, v.visits ?? 0);
      cur.uniqueVisitors = Math.max(cur.uniqueVisitors, v.uniqueVisitors ?? 0);
      cur.formStart = Math.max(cur.formStart, v.formStart ?? 0);
      cur.formSuccess = Math.max(cur.formSuccess, v.formSuccess ?? 0);
      if ((v.pageViews ?? 0) + (v.visits ?? 0) + (v.formSuccess ?? 0) + (v.formStart ?? 0) > 0) {
        cur.has = true;
        if (dim.segment) cur.segments.add(dim.segment);
      }
      acc.set(val.inventoryId, cur);
    }
  }

  await prisma.urlInventory.updateMany({
    data: {
      aaPageViews: 0,
      aaVisits: 0,
      aaUniqueVisitors: 0,
      aaFormStart: 0,
      aaFormSuccess: 0,
      aaHasData: false,
      aaSegments: [],
    },
  });

  const entries = [...acc.entries()];
  const BATCH = 200;
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    await prisma.$transaction(
      slice.map(([id, a]) =>
        prisma.urlInventory.update({
          where: { id },
          data: {
            aaPageViews: a.pageViews,
            aaVisits: a.visits,
            aaUniqueVisitors: a.uniqueVisitors,
            aaFormStart: a.formStart,
            aaFormSuccess: a.formSuccess,
            aaHasData: a.has,
            aaSegments: [...a.segments],
          },
        })
      )
    );
  }

  return { updated: entries.length };
}

export function listAdobeSeedStatus() {
  return ADOBE_FILES.map((f) => ({
    ...f,
    exists: fs.existsSync(path.join(DATA_DIR, f.file)),
  }));
}
