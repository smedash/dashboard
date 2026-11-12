import ExcelJS from "exceljs";
import {
  type DropdownKey,
  type DropdownOptions,
  type MapCta,
  type MapUrlDto,
  DROPDOWN_KEYS,
  cleanText,
  normalizeKeyword,
  parseRank,
  splitKeywords,
} from "./shared";

export type MappingField =
  | "url"
  | "h1"
  | "noindex"
  | "statusCode"
  | "navigationType"
  | "pageType"
  | "funnel"
  | "targetGroup"
  | "topicAuthority"
  | "focusKeyword"
  | "focusSearchVolume"
  | "subKeywords"
  | "subSearchVolume"
  | "ctaLabel"
  | "ctaLink"
  | "furtherLinks"
  | "dfsTopKeyword"
  | "dfsSearchVolume"
  | "dfsRank"
  | "manualRank"
  | "gscClicks"
  | "comment";

export interface ColumnMapping {
  column: number;
  header: string;
  group: string | null;
  field: MappingField | null;
  ctaIndex?: number;
}

export interface ParsedMappingRow {
  url: string;
  h1: string | null;
  noindex: boolean;
  statusCode: number | null;
  navigationType: string | null;
  pageType: string | null;
  funnel: string | null;
  targetGroup: string | null;
  topicAuthority: string | null;
  focusKeyword: string | null;
  focusSearchVolume: number | null;
  subKeywords: string[];
  subSearchVolume: number | null;
  ctas: MapCta[];
  furtherLinks: string[];
  dfsTopKeyword: string | null;
  dfsSearchVolume: number | null;
  dfsRank: number | null;
  manualRank: string | null;
  gscClicks: number | null;
  comment: string | null;
}

export interface ParsedWorkbook {
  mappingSheets: string[];
  sheet: string | null;
  headerRow: number | null;
  columns: ColumnMapping[];
  rows: ParsedMappingRow[];
  dropdownOptions: DropdownOptions;
  warnings: string[];
}

/** Liest einen Zellwert als Text (richText, Formel-Ergebnis, Hyperlink, Datum). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((r) => r.text).join("");
    if ("formula" in value || "sharedFormula" in value) {
      const result = (value as ExcelJS.CellFormulaValue).result;
      if (result === undefined || result === null || (typeof result === "object" && "error" in result)) return "";
      return cellText(result as ExcelJS.CellValue);
    }
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("hyperlink" in value && typeof value.hyperlink === "string") return value.hyperlink;
    if ("error" in value) return "";
  }
  return "";
}

// ExcelJS berechnet `columnCount` bei jedem Zugriff über alle Zeilen neu
const columnCounts = new WeakMap<ExcelJS.Worksheet, number>();
function columnCount(ws: ExcelJS.Worksheet): number {
  let n = columnCounts.get(ws);
  if (n === undefined) {
    n = ws.columnCount;
    columnCounts.set(ws, n);
  }
  return n;
}

function rowTexts(ws: ExcelJS.Worksheet, rowNumber: number): string[] {
  const values = ws.getRow(rowNumber).values as ExcelJS.CellValue[];
  const out: string[] = [];
  const max = columnCount(ws);
  for (let c = 1; c <= max; c++) {
    out[c] = cleanText(cellText(values[c] ?? null));
  }
  return out;
}

const norm = (s: string) => cleanText(s).toLowerCase();

function findHeaderRow(ws: ExcelJS.Worksheet): number | null {
  for (let r = 1; r <= Math.min(6, ws.rowCount); r++) {
    const texts = rowTexts(ws, r).map((t) => (t ? norm(t) : ""));
    if (
      texts.includes("url") &&
      texts.some((t) => t.startsWith("fokus-keyword")) &&
      texts.some((t) => t === "themenhoheit" || t.startsWith("nebenkeyword"))
    ) {
      return r;
    }
  }
  return null;
}

/** Ordnet die Excel-Spalten anhand von Spaltenname, Gruppen-Kopfzeile und Reihenfolge den Feldern zu. */
function mapColumns(ws: ExcelJS.Worksheet, headerRow: number): ColumnMapping[] {
  const headers = rowTexts(ws, headerRow);
  const groupsRaw = headerRow > 1 ? rowTexts(ws, 1) : [];
  const columns: ColumnMapping[] = [];
  let currentGroup: string | null = null;
  let lastKeywordField: "focusKeyword" | "subKeywords" | null = null;
  let lastCtaIndex: number | null = null;
  let seenFocus = false;
  let seenFurtherLinks = false;

  for (let c = 1; c <= columnCount(ws); c++) {
    if (groupsRaw[c]) currentGroup = groupsRaw[c];
    const header = headers[c] ?? "";
    const h = norm(header);
    const group = currentGroup ? norm(currentGroup) : null;
    let field: MappingField | null = null;
    let ctaIndex: number | undefined;

    if (!h) {
      // In manchen Vorlagen hat die Spalte mit den weiterführenden Links keinen Namen
      const unnamedLinks = group === "internal linking" && !seenFurtherLinks && lastCtaIndex === null && groupsRaw[c];
      if (unnamedLinks) seenFurtherLinks = true;
      columns.push({ column: c, header, group: currentGroup, field: unnamedLinks ? "furtherLinks" : null });
      continue;
    }

    const ctaMatch = h.match(/^cta\s*(\d+)/);
    if (h === "url") field = "url";
    else if (h === "h1") field = "h1";
    else if (h === "noindex") field = "noindex";
    else if (h === "status") field = "statusCode";
    else if (h.includes("navigation") || /^(help\s*\/\s*)?guide/.test(h)) field = "navigationType";
    else if (h === "page type") field = "pageType";
    else if (h.includes("funnel") || h.startsWith("business-ziel")) field = "funnel";
    else if (h === "zielgruppe") field = "targetGroup";
    else if (h === "themenhoheit") field = "topicAuthority";
    else if (h.startsWith("fokus-keyword") || h.startsWith("fokuskeyword")) {
      // Die zweite "Fokus-Keyword"-Spalte im Performance-Block ist nur ein Lookup
      if (!seenFocus && group !== "performance") {
        field = "focusKeyword";
        seenFocus = true;
        lastKeywordField = "focusKeyword";
      }
    } else if (h.startsWith("nebenkeyword") || h.startsWith("subkeyword")) {
      field = "subKeywords";
      lastKeywordField = "subKeywords";
    } else if (h.startsWith("suchvolumen pro monat")) {
      if (lastKeywordField === "focusKeyword") field = "focusSearchVolume";
      else if (lastKeywordField === "subKeywords") field = "subSearchVolume";
      lastKeywordField = null;
    } else if (ctaMatch) {
      field = "ctaLabel";
      ctaIndex = parseInt(ctaMatch[1], 10) - 1;
      lastCtaIndex = ctaIndex;
    } else if (h === "link" && lastCtaIndex !== null) {
      field = "ctaLink";
      ctaIndex = lastCtaIndex;
      lastCtaIndex = null;
    } else if (h.startsWith("further links") || h.startsWith("weiterführende")) {
      field = "furtherLinks";
      seenFurtherLinks = true;
    } else if (h.startsWith("top keyword")) field = "dfsTopKeyword";
    else if (h.startsWith("suchvolumen (dataforseo")) field = "dfsSearchVolume";
    else if (h.startsWith("ranking (dataforseo")) field = "dfsRank";
    else if (h.startsWith("ranking (manuell")) field = "manualRank";
    else if (h.startsWith("gsc klicks") || h.startsWith("gsc clicks")) field = "gscClicks";
    else if (h === "kommentar" || h === "comment") field = "comment";

    columns.push({ column: c, header, group: currentGroup, field, ...(ctaIndex !== undefined ? { ctaIndex } : {}) });
  }
  return columns;
}

const toNullable = (v: string) => (v && v !== "-" ? v : null);

function toInt(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(/['’\s]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseRows(ws: ExcelJS.Worksheet, headerRow: number, columns: ColumnMapping[]): ParsedMappingRow[] {
  const rows: ParsedMappingRow[] = [];
  const seen = new Set<string>();
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const texts = rowTexts(ws, r);
    const get = (field: MappingField) => {
      const col = columns.find((c) => c.field === field);
      return col ? texts[col.column] ?? "" : "";
    };
    const url = get("url");
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);

    const ctas: MapCta[] = [];
    for (const col of columns) {
      if ((col.field !== "ctaLabel" && col.field !== "ctaLink") || col.ctaIndex === undefined) continue;
      const value = texts[col.column] ?? "";
      ctas[col.ctaIndex] = ctas[col.ctaIndex] ?? { label: "", link: "" };
      if (col.field === "ctaLabel") ctas[col.ctaIndex].label = value;
      else ctas[col.ctaIndex].link = value;
    }
    while (ctas.length > 0 && !ctas[ctas.length - 1]?.label && !ctas[ctas.length - 1]?.link) ctas.pop();

    const focusRaw = get("focusKeyword");
    const focusKeyword = focusRaw && focusRaw !== "-" ? normalizeKeyword(focusRaw) : null;
    const noindexRaw = norm(get("noindex"));

    rows.push({
      url,
      h1: toNullable(get("h1")),
      noindex: noindexRaw === "noindex" || noindexRaw === "ja" || noindexRaw === "true" || noindexRaw === "x",
      statusCode: toInt(get("statusCode")),
      navigationType: toNullable(get("navigationType")),
      pageType: toNullable(get("pageType")),
      funnel: toNullable(get("funnel")),
      targetGroup: toNullable(get("targetGroup")),
      topicAuthority: toNullable(get("topicAuthority")),
      focusKeyword,
      focusSearchVolume: focusKeyword ? toInt(get("focusSearchVolume")) : null,
      subKeywords: splitKeywords(get("subKeywords")).filter((k) => k !== focusKeyword),
      subSearchVolume: toInt(get("subSearchVolume")) || null,
      ctas: ctas.map((c) => c ?? { label: "", link: "" }),
      furtherLinks: get("furtherLinks")
        .split(/\s*\n\s*/)
        .map((l) => l.trim())
        .filter((l) => /^https?:\/\/|^\//.test(l)),
      dfsTopKeyword: toNullable(get("dfsTopKeyword")),
      dfsSearchVolume: toInt(get("dfsSearchVolume")),
      dfsRank: parseRank(get("dfsRank")),
      manualRank: toNullable(get("manualRank")),
      gscClicks: toInt(get("gscClicks")),
      comment: toNullable(get("comment")),
    });
  }
  return rows;
}

function parseDropdowns(wb: ExcelJS.Workbook): DropdownOptions {
  const ws = wb.worksheets.find((s) => norm(s.name).startsWith("drop down") || norm(s.name).startsWith("dropdown"));
  if (!ws) return {};
  const headers = rowTexts(ws, 1);
  const keyByHeader = (h: string): DropdownKey | null => {
    const n = norm(h);
    if (n === "page type") return "pageType";
    if (n.includes("funnel") || n.startsWith("business-ziel")) return "funnel";
    if (n === "zielgruppe") return "targetGroup";
    if (n === "themenhoheit") return "topicAuthority";
    return null;
  };
  const out: DropdownOptions = {};
  for (let c = 1; c <= columnCount(ws); c++) {
    const key = keyByHeader(headers[c] ?? "");
    if (!key) continue;
    const values: string[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const v = rowTexts(ws, r)[c];
      if (v && !values.includes(v)) values.push(v);
    }
    if (values.length > 0) out[key] = values;
  }
  return out;
}

/** Ergänzt Dropdown-Optionen um Werte, die in den Zeilen vorkommen, aber im Dropdown-Sheet fehlen. */
export function mergeDropdownOptions(base: DropdownOptions, rows: Array<Partial<Record<DropdownKey, string | null>>>): DropdownOptions {
  const out: DropdownOptions = {};
  for (const key of DROPDOWN_KEYS) {
    const values = [...(base[key] ?? [])];
    for (const row of rows) {
      const v = row[key];
      if (v && !values.includes(v)) values.push(v);
    }
    if (values.length > 0) out[key] = values;
  }
  return out;
}

export async function parseMappingWorkbook(buffer: ArrayBuffer, sheetName?: string | null): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const warnings: string[] = [];

  const candidates = wb.worksheets.filter((ws) => findHeaderRow(ws) !== null);
  const mappingSheets = candidates.map((ws) => ws.name);
  const ws =
    (sheetName ? candidates.find((s) => s.name === sheetName) : null) ??
    candidates.find((s) => norm(s.name) === "mapping") ??
    candidates[0];

  const dropdownOptions = parseDropdowns(wb);

  if (!ws) {
    return {
      mappingSheets,
      sheet: null,
      headerRow: null,
      columns: [],
      rows: [],
      dropdownOptions,
      warnings: ["Kein Mapping-Sheet gefunden (benötigt Spalten „URL“ und „Fokus-Keyword“)."],
    };
  }
  if (sheetName && ws.name !== sheetName) warnings.push(`Sheet „${sheetName}“ nicht gefunden, verwende „${ws.name}“.`);
  if (candidates.length > 1) warnings.push(`Mehrere Mapping-Sheets gefunden: ${mappingSheets.join(", ")}.`);

  const headerRow = findHeaderRow(ws)!;
  const columns = mapColumns(ws, headerRow);
  const rows = parseRows(ws, headerRow, columns);
  // Lookup-/Berechnungsspalten werden neu berechnet und deshalb bewusst nicht übernommen
  const derivedGroups = new Set(["performance", "topic-gap", "kvp"]);
  const unmapped = columns
    .filter((c) => c.header && !c.field && !derivedGroups.has(norm(c.group ?? "")) && norm(c.header) !== "score")
    .map((c) => c.header);
  if (unmapped.length > 0) warnings.push(`Nicht übernommene Spalten: ${unmapped.join(", ")}.`);

  return {
    mappingSheets,
    sheet: ws.name,
    headerRow,
    columns,
    rows,
    dropdownOptions: mergeDropdownOptions(dropdownOptions, rows),
    warnings,
  };
}

interface ExportGapInfo {
  coverageScore: number | null;
  missingTopics: string[];
}

/** Baut eine XLSX-Datei im Layout der bisherigen Mapping-Excels (Gruppen-Kopfzeile + Spalten-Kopfzeile). */
export async function buildMappingWorkbook(params: {
  projectName: string;
  urls: MapUrlDto[];
  dropdownOptions: DropdownOptions;
  gaps: Map<string, ExportGapInfo>;
}): Promise<ArrayBuffer> {
  const { urls, dropdownOptions, gaps } = params;
  const ctaCount = Math.max(3, ...urls.map((u) => u.ctas.length));

  type Col = { group: string; header: string; width: number; value: (u: MapUrlDto) => string | number | null };
  const cols: Col[] = [
    { group: "Address", header: "URL", width: 60, value: (u) => u.url },
    { group: "Address", header: "H1", width: 40, value: (u) => u.h1 },
    { group: "Indexierungsstatus", header: "Noindex", width: 10, value: (u) => (u.noindex ? "noindex" : null) },
    { group: "Indexierungsstatus", header: "Status", width: 8, value: (u) => u.statusCode },
    { group: "Basics", header: "Guide/Navigation", width: 14, value: (u) => u.navigationType },
    { group: "Basics", header: "Page Type", width: 20, value: (u) => u.pageType },
    { group: "Basics", header: "Business-Ziel / Funnel", width: 28, value: (u) => u.funnel },
    { group: "Basics", header: "Zielgruppe", width: 28, value: (u) => u.targetGroup },
    { group: "Topic", header: "Themenhoheit", width: 24, value: (u) => u.topicAuthority },
    { group: "Topic", header: "Fokus-Keyword", width: 28, value: (u) => u.focusKeyword?.keyword ?? null },
    { group: "Topic", header: "Suchvolumen pro Monat", width: 12, value: (u) => u.focusKeyword?.searchVolume ?? null },
    { group: "Topic", header: "Nebenkeywords", width: 40, value: (u) => u.subKeywords.map((k) => k.keyword).join(", ") || null },
    { group: "Topic", header: "Suchvolumen pro Monat", width: 12, value: (u) => u.subSearchVolume },
  ];
  for (let i = 0; i < ctaCount; i++) {
    cols.push({ group: "Internal Linking", header: `CTA ${i + 1}`, width: 24, value: (u) => u.ctas[i]?.label || null });
    cols.push({ group: "Internal Linking", header: "Link", width: 30, value: (u) => u.ctas[i]?.link || null });
  }
  cols.push(
    { group: "Internal Linking", header: "Further Links (exkl. PDFs)", width: 40, value: (u) => u.furtherLinks.join("\n") || null },
    { group: "Performance", header: "Top Keyword (DataforSEO)", width: 28, value: (u) => u.dfsTopKeyword },
    { group: "Performance", header: "Suchvolumen (DataforSEO)", width: 12, value: (u) => u.dfsSearchVolume },
    { group: "Performance", header: "Ranking (DataforSEO)", width: 10, value: (u) => u.dfsRank },
    { group: "Performance", header: "Ranking (manuelle Abfrage)", width: 10, value: (u) => u.manualRank },
    { group: "Performance", header: "GSC Klicks (last 6 months)", width: 12, value: (u) => u.gscClicks },
    { group: "Performance", header: "Score", width: 8, value: (u) => u.score },
    { group: "Topic-Gap", header: "Topic-Coverage (%)", width: 12, value: (u) => gaps.get(u.id)?.coverageScore ?? null },
    { group: "Topic-Gap", header: "Fehlende Topics", width: 50, value: (u) => gaps.get(u.id)?.missingTopics.join(", ") || null },
    { group: "KVP", header: "Im SEO KVP", width: 10, value: (u) => (u.kvpUrlId ? "ja" : null) },
    { group: "Kommentar", header: "Kommentar", width: 40, value: (u) => u.comment }
  );

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Mapping", { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }] });
  ws.addRow(cols.map((c) => c.group));
  ws.addRow(cols.map((c) => c.header));
  for (const u of urls) ws.addRow(cols.map((c) => c.value(u) ?? null));

  cols.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width;
  });
  // Gruppen-Kopfzeile zusammenfassen
  let start = 1;
  for (let i = 1; i <= cols.length; i++) {
    if (i === cols.length || cols[i].group !== cols[start - 1].group) {
      if (i > start) ws.mergeCells(1, start, 1, i);
      start = i + 1;
    }
  }
  for (const r of [1, 2]) {
    const row = ws.getRow(r);
    row.font = { bold: true };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: r === 1 ? "FFD9E1F2" : "FFF2F2F2" } };
    row.alignment = { vertical: "middle", wrapText: true };
  }

  const dd = wb.addWorksheet("Drop Down Fields");
  const ddHeaders: Record<DropdownKey, string> = {
    pageType: "Page Type",
    funnel: "Business-Ziel / Funnel",
    targetGroup: "Zielgruppe",
    topicAuthority: "Themenhoheit",
  };
  dd.addRow(DROPDOWN_KEYS.map((k) => ddHeaders[k]));
  dd.getRow(1).font = { bold: true };
  const maxLen = Math.max(0, ...DROPDOWN_KEYS.map((k) => dropdownOptions[k]?.length ?? 0));
  for (let i = 0; i < maxLen; i++) dd.addRow(DROPDOWN_KEYS.map((k) => dropdownOptions[k]?.[i] ?? null));
  DROPDOWN_KEYS.forEach((_, i) => (dd.getColumn(i + 1).width = 36));

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
