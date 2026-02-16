const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const excelFile = path.join(process.cwd(), "public", "seo-checkliste.xlsx");
const outputFile = path.join(process.cwd(), "scripts", "seo-checklist.json");
const logFile = path.join(process.cwd(), "scripts", "read-seo-checklist.log");

let log = "";

function logMsg(msg) {
  log += msg + "\n";
  console.log(msg);
}

async function main() {
  try {
    logMsg(`Lese Excel-Datei: ${excelFile}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelFile);
    const worksheet = workbook.worksheets[0];
    logMsg(`Verwende Sheet: ${worksheet.name}`);

    const data = [];
    worksheet.eachRow((row) => {
      data.push(row.values);
    });

    const items = [];
    let currentCategory = "";

    const knownCategories = [
      "The Foundation",
      "User Experience",
      "Performance",
      "Technical SEO",
      "Content",
      "On-Page SEO",
      "Off-Page SEO",
      "Local SEO",
    ];

    logMsg(`Verarbeite ${data.length} Zeilen...`);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 3) continue;

      const title = row[2]?.toString().trim() || "";

      if (!title || title === "Title") continue;

      const matchedCategory = knownCategories.find((cat) => title === cat);
      if (matchedCategory) {
        currentCategory = matchedCategory;
        logMsg(`Kategorie gefunden (Zeile ${i}): ${currentCategory}`);
        continue;
      }

      if (currentCategory && title) {
        items.push({
          category: currentCategory,
          title: title,
          description: undefined,
        });
      }
    }

    logMsg(`\nExtrahierte ${items.length} Items`);

    if (items.length === 0) {
      logMsg("\nFEHLER: Keine Items gefunden!");
      logMsg("Erste 20 Zeilen zur Analyse:");
      for (let i = 0; i < Math.min(20, data.length); i++) {
        const row = data[i];
        if (row && row.length > 2) {
          logMsg(`  Zeile ${i}: [${row[1]}, "${row[2]}"]`);
        }
      }
    } else {
      fs.writeFileSync(outputFile, JSON.stringify(items, null, 2));
      logMsg(`\nDaten wurden in ${outputFile} gespeichert`);

      logMsg(`\nKategorien:`);
      const categories = [...new Set(items.map((item) => item.category))];
      categories.forEach((cat) => {
        const count = items.filter((item) => item.category === cat).length;
        logMsg(`  - ${cat}: ${count} Items`);
      });

      logMsg(`\nErste 5 Items als Beispiel:`);
      items.slice(0, 5).forEach((item) => {
        logMsg(`  [${item.category}] ${item.title}`);
      });
    }

    fs.writeFileSync(logFile, log);
  } catch (error) {
    const errorMsg = `Fehler: ${error.message}\n${error.stack}`;
    logMsg(errorMsg);
    fs.writeFileSync(logFile, log);
    process.exit(1);
  }
}

main();
