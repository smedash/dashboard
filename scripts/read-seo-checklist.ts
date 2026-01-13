import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const excelFile = path.join(process.cwd(), "public", "seo-checkliste.xlsx");

try {
  const workbook = XLSX.readFile(excelFile);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  console.log("Excel Daten:");
  console.log(JSON.stringify(data, null, 2));

  // Versuche die Struktur zu verstehen
  const items: Array<{ category: string; title: string; description?: string }> = [];

  // Erste Zeile könnte Header sein
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as any[];
    if (row && row.length > 0) {
      const category = row[0]?.toString().trim() || "";
      const title = row[1]?.toString().trim() || "";
      const description = row[2]?.toString().trim() || "";

      if (category && title) {
        items.push({
          category,
          title,
          description: description || undefined,
        });
      }
    }
  }

  console.log("\n\nExtrahierte Items:");
  console.log(JSON.stringify(items, null, 2));
} catch (error) {
  console.error("Fehler beim Lesen der Excel-Datei:", error);
}
