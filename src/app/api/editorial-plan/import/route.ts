import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import * as XLSX from "xlsx";

const VALID_CATEGORIES = ["Mortgages", "Accounts&Cards", "Investing", "Pension", "Digital Banking"];
const VALID_LOCATIONS = ["Guide", "Insights"];

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
};

function normalizeCategory(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (VALID_CATEGORIES.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const exact = VALID_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  return CATEGORY_ALIASES[lower] || null;
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
    const workbook = XLSX.read(buffer, { type: "buffer" });
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

    const validRows = rows.filter((row) => row[headerMap.title]?.toString().trim());
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const interval = daysInMonth / validRows.length;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const title = row[headerMap.title]?.toString().trim();

      if (!title) {
        skipped++;
        continue;
      }

      const category = headerMap.category ? row[headerMap.category]?.toString().trim() : undefined;
      const location = headerMap.location ? row[headerMap.location]?.toString().trim() : undefined;

      const day = Math.min(Math.floor(imported * interval) + 1, daysInMonth);
      const plannedDate = new Date(year, month, day, 12, 0, 0);

      try {
        await prisma.editorialPlanArticle.create({
          data: {
            title,
            url: headerMap.url ? row[headerMap.url]?.toString().trim() || null : null,
            metaDescription: headerMap.metaDescription ? row[headerMap.metaDescription]?.toString().trim() || null : null,
            h1: headerMap.h1 ? row[headerMap.h1]?.toString().trim() || null : null,
            schemaMarkup: headerMap.schemaMarkup ? row[headerMap.schemaMarkup]?.toString().trim() || null : null,
            category: normalizeCategory(category),
            location: location && VALID_LOCATIONS.includes(location) ? location : null,
            status: "idea",
            plannedDate,
            creatorId: session.user.id,
          },
        });
        imported++;
      } catch (err) {
        errors.push(`Zeile ${i + 2}: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
        skipped++;
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
