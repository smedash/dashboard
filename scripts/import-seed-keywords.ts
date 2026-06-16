import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import * as path from "path";
import * as fs from "fs";

const prisma = new PrismaClient();

interface ExcelRow {
  Kategorie: string;
  "Seed-Keyword": string;
  "Vollständige Bezeichnung"?: string;
  Typ?: string;
  URL?: string;
}

async function importSeedKeywords(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Datei nicht gefunden: ${filePath}`);
    process.exit(1);
  }

  console.log(`📂 Lese Excel-Datei: ${filePath}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "");
  });
  const rows: ExcelRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string> = {};
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber - 1];
      if (key) obj[key] = String(cell.value ?? "");
    });
    if (Object.keys(obj).length > 0) rows.push(obj as unknown as ExcelRow);
  });

  console.log(`📊 ${rows.length} Zeilen gefunden\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const keyword = row["Seed-Keyword"]?.trim();
    const category = row["Kategorie"]?.trim();

    if (!keyword || !category) {
      skipped++;
      continue;
    }

    try {
      await prisma.seedKeyword.upsert({
        where: {
          keyword_category: { keyword, category },
        },
        create: {
          keyword,
          category,
          fullName: row["Vollständige Bezeichnung"]?.trim() || null,
          type: row["Typ"]?.trim() || null,
          url: row["URL"]?.trim() || null,
        },
        update: {
          fullName: row["Vollständige Bezeichnung"]?.trim() || null,
          type: row["Typ"]?.trim() || null,
          url: row["URL"]?.trim() || null,
        },
      });

      const existing = await prisma.seedKeyword.findUnique({
        where: { keyword_category: { keyword, category } },
      });
      if (existing && existing.createdAt < new Date(Date.now() - 1000)) {
        updated++;
      } else {
        created++;
      }
    } catch (error) {
      console.error(`  ❌ Fehler bei "${keyword}" (${category}):`, error);
    }
  }

  const categories = [...new Set(rows.map((r) => r["Kategorie"]?.trim()).filter(Boolean))];

  console.log(`✅ Import abgeschlossen:`);
  console.log(`   Erstellt: ${created}`);
  console.log(`   Aktualisiert: ${updated}`);
  console.log(`   Uebersprungen: ${skipped}`);
  console.log(`\n📁 Kategorien (${categories.length}):`);
  for (const cat of categories.sort()) {
    const count = rows.filter((r) => r["Kategorie"]?.trim() === cat).length;
    console.log(`   - ${cat} (${count} Keywords)`);
  }
}

const filePath = process.argv[2] || path.join(__dirname, "..", "data", "UBS_Produktportfolio_Seed-Keywords.xlsx");

importSeedKeywords(filePath)
  .catch((error) => {
    console.error("❌ Import fehlgeschlagen:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
