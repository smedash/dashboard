import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { lookupInventoryId, toUrlKey } from "@/lib/url-cleanup/normalize";

export const maxDuration = 180;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `excel_${base || "import"}_${Date.now().toString(36)}`;
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v && "text" in (v as { text?: string })) {
    return String((v as { text?: string }).text ?? "");
  }
  return String(v).trim();
}

function detectType(values: string[]): "number" | "string" {
  let nums = 0;
  let n = 0;
  for (const v of values) {
    if (!v) continue;
    n++;
    if (Number.isFinite(Number(v.replace(/,/g, "")))) nums++;
  }
  return n > 0 && nums / n >= 0.8 ? "number" : "string";
}

async function parseWorkbook(buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Keine Tabelle in der Excel-Datei");
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellStr(cell.value) || `Spalte ${col}`;
  });
  const rows: string[][] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const vals: string[] = [];
    for (let i = 0; i < headers.length; i++) {
      vals[i] = cellStr(row.getCell(i + 1).value);
    }
    if (vals.some((v) => v)) rows.push(vals);
  });
  return { headers, rows };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Datei fehlt" }, { status: 400 });
    }
    const preview = form.get("preview") === "true";
    const name = String(form.get("name") || file.name.replace(/\.xlsx?$/i, ""));
    const urlColumn = String(form.get("urlColumn") || "");
    const periodStart = String(form.get("periodStart") || "");
    const periodEnd = String(form.get("periodEnd") || "");

    const buffer = await file.arrayBuffer();
    const { headers, rows } = await parseWorkbook(buffer);

    const guessedUrl =
      urlColumn ||
      headers.find((h) => /url|page|path|pages/i.test(h)) ||
      headers[0] ||
      "";

    if (preview) {
      const urlIdx = headers.indexOf(guessedUrl);
      const sample = rows.slice(0, 8);
      const cols = headers
        .filter((h) => h !== guessedUrl)
        .map((h) => {
          const idx = headers.indexOf(h);
          const vals = rows.slice(0, 80).map((r) => r[idx] || "");
          return { key: h, label: h, type: detectType(vals) };
        });

      let matched = 0;
      let unmatched = 0;
      const inventory = await prisma.urlInventory.findMany({
        select: { urlKey: true, urlKeyNoHtml: true },
      });
      const byKey = new Map(inventory.map((r) => [r.urlKey, true] as const));
      const byNoHtml = new Map(inventory.map((r) => [r.urlKeyNoHtml, true] as const));
      const probe = rows.slice(0, 400);
      for (const r of probe) {
        const raw = urlIdx >= 0 ? r[urlIdx] : "";
        const keys = toUrlKey(raw);
        if (keys && (byKey.has(keys.urlKey) || byNoHtml.has(keys.urlKeyNoHtml))) matched++;
        else unmatched++;
      }

      return NextResponse.json({
        preview: true,
        headers,
        guessedUrl,
        columns: cols,
        sample,
        rowCount: rows.length,
        probeMatchRate: probe.length ? matched / probe.length : 0,
        periodStart,
        periodEnd,
        name,
      });
    }

    const urlIdx = headers.indexOf(urlColumn || guessedUrl);
    if (urlIdx < 0) {
      return NextResponse.json({ error: "URL-Spalte nicht gefunden" }, { status: 400 });
    }

    const dataCols = headers
      .map((h, i) => ({ h, i }))
      .filter((c) => c.i !== urlIdx);
    const colTypes = dataCols.map((c) => ({
      key: c.h,
      label: c.h,
      type: detectType(rows.slice(0, 200).map((r) => r[c.i] || "")),
    }));

    const inventory = await prisma.urlInventory.findMany({
      select: { id: true, urlKey: true, urlKeyNoHtml: true },
    });
    const byKey = new Map<string, string>();
    const byNoHtml = new Map<string, string>();
    for (const r of inventory) {
      byKey.set(r.urlKey, r.id);
      if (!byNoHtml.has(r.urlKeyNoHtml)) byNoHtml.set(r.urlKeyNoHtml, r.id);
    }

    const merged = new Map<string, Record<string, string | number>>();
    const unmatchedSample: string[] = [];
    let unmatched = 0;

    for (const r of rows) {
      const raw = r[urlIdx] || "";
      const keys = toUrlKey(raw);
      const id = keys ? lookupInventoryId(keys, byKey, byNoHtml) : undefined;
      if (!id) {
        unmatched++;
        if (unmatchedSample.length < 40) unmatchedSample.push(raw);
        continue;
      }
      const values: Record<string, string | number> = merged.get(id) ?? {};
      for (const c of dataCols) {
        const spec = colTypes.find((t) => t.key === c.h);
        const rawVal = r[c.i] || "";
        if (spec?.type === "number") {
          const n = Number(rawVal.replace(/,/g, ""));
          const prev = typeof values[c.h] === "number" ? (values[c.h] as number) : 0;
          values[c.h] = prev + (Number.isFinite(n) ? n : 0);
        } else if (rawVal && !values[c.h]) {
          values[c.h] = rawVal;
        }
      }
      merged.set(id, values);
    }

    const dimension = await prisma.urlDimension.create({
      data: {
        slug: slugify(name),
        name,
        sourceType: "excel",
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        columns: colTypes,
        matchedCount: merged.size,
        unmatchedCount: unmatched,
        unmatchedSample,
      },
    });

    const valueRows = [...merged.entries()].map(([inventoryId, values]) => ({
      inventoryId,
      dimensionId: dimension.id,
      values,
    }));
    const BATCH = 500;
    for (let i = 0; i < valueRows.length; i += BATCH) {
      await prisma.urlDimensionValue.createMany({ data: valueRows.slice(i, i + BATCH) });
    }

    return NextResponse.json({
      ok: true,
      dimension: {
        id: dimension.id,
        slug: dimension.slug,
        name: dimension.name,
        matchedCount: merged.size,
        unmatchedCount: unmatched,
      },
    });
  } catch (e) {
    console.error("[url-cleanup/import]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import fehlgeschlagen" },
      { status: 500 }
    );
  }
}
