import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { canEdit } from "@/lib/rbac";
import * as XLSX from "xlsx";

const WIN1252_REVERSE: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function fixMojibake(text: string): string {
  let hasHighChars = false;
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp >= 0xc0 && cp <= 0xff) { hasHighChars = true; break; }
  }
  if (!hasHighChars) return text;

  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp < 0x80) { bytes.push(cp); }
    else if (cp >= 0xa0 && cp <= 0xff) { bytes.push(cp); }
    else {
      const b = WIN1252_REVERSE[cp];
      if (b !== undefined) { bytes.push(b); } else { return text; }
    }
  }
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    if (decoded !== text && decoded.length < text.length) return decoded;
  } catch { /* not mojibake */ }
  return text;
}

function cleanText(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return fixMojibake(trimmed);
}

const VALID_CATEGORIES = [
  "Mortgages", "Accounts&Cards", "Investing", "Pension", "Digital Banking",
  "Credit Suisse", "Investor Relations", "Legal", "Media", "Payments",
  "Yumo", "Wealthmanagement", "Assetmanagement",
];
const VALID_LOCATIONS = ["Guide", "Insights", "CH Market", "Global", "Microsites", "Minisites"];

const CATEGORY_ALIASES: Record<string, string> = {
  "investments": "Investing",
  "investment": "Investing",
  "invest": "Investing",
  "mortgage": "Mortgages",
  "hypotheken": "Mortgages",
  "hypothek": "Mortgages",
  "accounts": "Accounts&Cards",
  "cards": "Accounts&Cards",
  "konto": "Accounts&Cards",
  "konten": "Accounts&Cards",
  "karten": "Accounts&Cards",
  "vorsorge": "Pension",
  "pensions": "Pension",
  "rente": "Pension",
  "digital": "Digital Banking",
  "banking": "Digital Banking",
  "credit suisse": "Credit Suisse",
  "cs": "Credit Suisse",
  "investor relations": "Investor Relations",
  "ir": "Investor Relations",
  "legal": "Legal",
  "recht": "Legal",
  "media": "Media",
  "medien": "Media",
  "payments": "Payments",
  "zahlung": "Payments",
  "zahlungen": "Payments",
  "yumo": "Yumo",
  "wealth management": "Wealthmanagement",
  "wealth": "Wealthmanagement",
  "wm": "Wealthmanagement",
  "asset management": "Assetmanagement",
  "asset": "Assetmanagement",
  "am": "Assetmanagement",
  "not categorized": "",
  "not categgorized": "",
  "keine kategorie": "",
};

function normalizeCategory(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (VALID_CATEGORIES.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const exact = VALID_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  const alias = CATEGORY_ALIASES[lower];
  if (alias !== undefined) return alias || null;
  return null;
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: "File contains no data" }, { status: 400 });
    }

    const headerKeys = Object.keys(rows[0]);
    const headerMap: Record<string, string> = {};
    for (const key of headerKeys) {
      const lower = key.toLowerCase().trim();
      if (lower === "url") headerMap.url = key;
      else if (lower === "title" || lower === "titel") headerMap.title = key;
      else if (lower.includes("meta") && lower.includes("description")) headerMap.metaDescription = key;
      else if (lower === "h1") headerMap.h1 = key;
      else if (lower.includes("schema")) headerMap.schemaMarkup = key;
      else if (lower === "kategorie" || lower === "category") headerMap.category = key;
      else if (lower === "location") headerMap.location = key;
    }

    if (!headerMap.title) {
      return NextResponse.json(
        { error: "Spalte 'TITLE' nicht gefunden. Benötigte Spalten: TITLE (Pflicht), URL, META DESCRIPTION, H1, SCHEMA.ORG TYPES, Kategorie, Location" },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 500;
    let batch: Prisma.EditorialPlanArticleCreateManyInput[] = [];

    const validRows = rows.filter((row) => row[headerMap.title]?.toString().trim());
    const totalValid = validRows.length;

    const SPREAD_MONTHS = 36;
    const now = new Date();
    const startDate = new Date(now.getFullYear() - 3, now.getMonth(), 1);

    function getPlannedDate(index: number): Date {
      const monthOffset = Math.floor((index / totalValid) * SPREAD_MONTHS);
      const targetMonth = new Date(startDate.getFullYear(), startDate.getMonth() + monthOffset, 1);
      const daysInTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();

      const firstIndexInMonth = Math.floor((monthOffset / SPREAD_MONTHS) * totalValid);
      const lastIndexInMonth = Math.floor(((monthOffset + 1) / SPREAD_MONTHS) * totalValid) - 1;
      const countInMonth = lastIndexInMonth - firstIndexInMonth + 1;
      const posInMonth = index - firstIndexInMonth;
      const day = Math.min(Math.floor((posInMonth / countInMonth) * daysInTargetMonth) + 1, daysInTargetMonth);

      return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day, 12, 0, 0);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const title = cleanText(row[headerMap.title]?.toString());

      if (!title) {
        skipped++;
        continue;
      }

      const category = headerMap.category ? row[headerMap.category]?.toString().trim() : undefined;
      const location = headerMap.location ? row[headerMap.location]?.toString().trim() : undefined;
      const normalizedLocation = location && !["no location", "keine location"].includes(location.toLowerCase()) && VALID_LOCATIONS.includes(location) ? location : null;

      const plannedDate = getPlannedDate(imported);

      batch.push({
        title,
        url: headerMap.url ? row[headerMap.url]?.toString().trim() || null : null,
        metaDescription: cleanText(row[headerMap.metaDescription]?.toString()),
        h1: cleanText(row[headerMap.h1]?.toString()),
        schemaMarkup: cleanText(row[headerMap.schemaMarkup]?.toString()),
        category: normalizeCategory(category),
        location: normalizedLocation,
        status: "idea",
        plannedDate,
        creatorId: session.user.id,
      });
      imported++;

      if (batch.length >= BATCH_SIZE) {
        try {
          await prisma.editorialPlanArticle.createMany({ data: batch });
        } catch (err) {
          errors.push(`Batch ab Zeile ~${i + 2 - BATCH_SIZE}: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
          skipped += batch.length;
          imported -= batch.length;
        }
        batch = [];
      }
    }

    if (batch.length > 0) {
      try {
        await prisma.editorialPlanArticle.createMany({ data: batch });
      } catch (err) {
        errors.push(`Letzter Batch: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
        skipped += batch.length;
        imported -= batch.length;
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      total: rows.length,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("Error importing editorial plan:", error);
    return NextResponse.json({ error: "Failed to import file" }, { status: 500 });
  }
}
