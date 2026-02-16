import ExcelJS from "exceljs";
import * as path from "path";

const excelFile = path.join(process.cwd(), "public", "seo-checkliste.xlsx");

try {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelFile);
  const worksheet = workbook.worksheets[0];
  const data: any[][] = [];
  worksheet.eachRow((row) => {
    data.push(row.values as any[]);
  });

  console.log("Excel Daten:");
  console.log(JSON.stringify(data, null, 2));

  const items: Array<{ category: string; title: string; description?: string }> = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row && row.length > 0) {
      const category = row[1]?.toString().trim() || "";
      const title = row[2]?.toString().trim() || "";
      const description = row[3]?.toString().trim() || "";

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
