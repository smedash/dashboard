import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { canEdit } from "@/lib/rbac";
import {
  cleanImportedOptionalText,
  titleMatchKey,
} from "@/lib/editorial-text-encoding";
import * as XLSX from "xlsx";

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

    const mode = ((formData.get("mode") as string | null) || "create").toLowerCase();
    const mergeMode = mode === "merge";

    if (mergeMode && !headerMap.url) {
      return NextResponse.json(
        { error: "Im Modus „Aktualisieren“ wird eine URL-Spalte benötigt, um bestehende Artikel zuzuordnen." },
        { status: 400 }
      );
    }

    if (mergeMode) {
      const urlColumn = headerMap.url;
      const allArticles = await prisma.editorialPlanArticle.findMany({
        select: { id: true, title: true },
      });
      const byTitle = new Map<string, string[]>();
      for (const a of allArticles) {
        const key = titleMatchKey(a.title);
        if (!key) continue;
        const list = byTitle.get(key) ?? [];
        list.push(a.id);
        byTitle.set(key, list);
      }

      let skipped = 0;
      let notFound = 0;
      let ambiguous = 0;
      const errors: string[] = [];
      /** Letzte URL pro Artikel-ID gewinnt (doppelte Zeilen in der Excel). */
      const urlByArticleId = new Map<string, string>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const title = titleMatchKey(row[headerMap.title]?.toString());
        if (!title) {
          skipped++;
          continue;
        }

        const newUrl = row[urlColumn]?.toString().trim();
        if (!newUrl) {
          skipped++;
          continue;
        }

        const ids = byTitle.get(title);
        if (!ids || ids.length === 0) {
          notFound++;
          continue;
        }
        if (ids.length > 1) {
          ambiguous++;
          continue;
        }

        urlByArticleId.set(ids[0], newUrl);
      }

      const pending = [...urlByArticleId.entries()].map(([id, url]) => ({ id, url }));
      let updated = 0;

      const TX_CHUNK = 40;
      for (let i = 0; i < pending.length; i += TX_CHUNK) {
        const chunk = pending.slice(i, i + TX_CHUNK);
        try {
          await prisma.$transaction(
            chunk.map((p) =>
              prisma.editorialPlanArticle.update({
                where: { id: p.id },
                data: { url: p.url },
              })
            )
          );
          updated += chunk.length;
        } catch (err) {
          errors.push(
            `Batch ${Math.floor(i / TX_CHUNK) + 1}: ${err instanceof Error ? err.message : "Update fehlgeschlagen"}`
          );
        }
      }

      return NextResponse.json({
        mode: "merge",
        updated,
        skipped,
        notFound,
        ambiguous,
        total: rows.length,
        errors: errors.slice(0, 10),
      });
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
      const title = titleMatchKey(row[headerMap.title]?.toString());

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
        metaDescription: cleanImportedOptionalText(row[headerMap.metaDescription]?.toString()),
        h1: cleanImportedOptionalText(row[headerMap.h1]?.toString()),
        schemaMarkup: cleanImportedOptionalText(row[headerMap.schemaMarkup]?.toString()),
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
