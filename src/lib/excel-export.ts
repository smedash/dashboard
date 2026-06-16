import ExcelJS from "exceljs";

/**
 * Creates an Excel workbook from rows (array of objects) and triggers a
 * browser download. Each entry in `sheets` becomes a separate worksheet.
 *
 * For multi-sheet exports just pass multiple entries.
 */
export async function downloadExcel(
  filename: string,
  sheets: {
    name: string;
    rows: Record<string, unknown>[];
    columnWidths?: number[];
    headerOverrides?: string[];
  }[],
) {
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    if (sheet.rows.length === 0) continue;

    const ws = workbook.addWorksheet(sheet.name);

    const keys = Object.keys(sheet.rows[0]);
    const headers = sheet.headerOverrides ?? keys;
    ws.addRow(headers);

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };

    for (const row of sheet.rows) {
      ws.addRow(keys.map((k) => row[k] ?? ""));
    }

    if (sheet.columnWidths) {
      sheet.columnWidths.forEach((w, i) => {
        const col = ws.getColumn(i + 1);
        col.width = w;
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
