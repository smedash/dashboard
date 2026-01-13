const XLSX = require("xlsx");
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

try {
  logMsg(`Lese Excel-Datei: ${excelFile}`);
  const workbook = XLSX.readFile(excelFile);
  const sheetName = workbook.SheetNames[0];
  logMsg(`Verwende Sheet: ${sheetName}`);
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const items = [];
  let currentCategory = "";

  // Bekannte Kategorien
  const knownCategories = [
    "The Foundation",
    "User Experience", 
    "Performance",
    "Technical SEO",
    "Content",
    "On-Page SEO",
    "Off-Page SEO",
    "Local SEO"
  ];

  logMsg(`Verarbeite ${data.length} Zeilen...`);

  // Durchlaufe alle Zeilen
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;

    const title = row[1]?.toString().trim() || "";
    
    if (!title || title === "Title") continue;

    // Prüfe ob es eine bekannte Kategorie ist
    const matchedCategory = knownCategories.find(cat => title === cat);
    if (matchedCategory) {
      currentCategory = matchedCategory;
      logMsg(`Kategorie gefunden (Zeile ${i}): ${currentCategory}`);
      continue;
    }

    // Wenn wir eine Kategorie haben und einen Titel, ist es ein Item
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
      if (row && row.length > 1) {
        logMsg(`  Zeile ${i}: [${row[0]}, "${row[1]}"]`);
      }
    }
  } else {
    // Speichere als JSON
    fs.writeFileSync(outputFile, JSON.stringify(items, null, 2));
    logMsg(`\nDaten wurden in ${outputFile} gespeichert`);
    
    logMsg(`\nKategorien:`);
    const categories = [...new Set(items.map(item => item.category))];
    categories.forEach(cat => {
      const count = items.filter(item => item.category === cat).length;
      logMsg(`  - ${cat}: ${count} Items`);
    });
    
    // Zeige erste paar Items als Beispiel
    logMsg(`\nErste 5 Items als Beispiel:`);
    items.slice(0, 5).forEach(item => {
      logMsg(`  [${item.category}] ${item.title}`);
    });
  }
  
  // Speichere Log
  fs.writeFileSync(logFile, log);
} catch (error) {
  const errorMsg = `Fehler: ${error.message}\n${error.stack}`;
  logMsg(errorMsg);
  fs.writeFileSync(logFile, log);
  process.exit(1);
}
