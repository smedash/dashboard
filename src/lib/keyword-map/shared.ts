/** Client- und serverseitig nutzbare Typen und Berechnungen für den SEO-Helper Keyword Mapping. */

export const DROPDOWN_KEYS = ["pageType", "funnel", "targetGroup", "topicAuthority"] as const;
export type DropdownKey = (typeof DROPDOWN_KEYS)[number];
export type DropdownOptions = Partial<Record<DropdownKey, string[]>>;

export type KeywordSource = "import" | "manual" | "dataforseo" | "seospark";

export interface MapKeywordDto {
  id: string;
  keyword: string;
  searchVolume: number | null;
  source: KeywordSource;
}

export interface MapCta {
  label: string;
  link: string;
}

export interface DfsKeywordRow {
  keyword: string;
  rankGroup: number;
  rankAbsolute: number | null;
  searchVolume: number | null;
}

export interface SubkeywordSuggestion {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  searchIntents: string[] | null;
  /** focus/sub, falls das Keyword dieser URL bereits zugeordnet ist */
  assignedHere: "focus" | "sub" | null;
  /** Andere URLs im Projekt, denen das Keyword zugeordnet ist (Kannibalisierungsrisiko) */
  assignedElsewhere: Array<{ urlId: string; url: string; type: string }>;
}

export type TopicCoverageStatus = "covered" | "partial" | "missing";

/** Andere URL aus dem Content-Mapping, die ein Topic bereits behandelt */
export interface TopicOtherUrl {
  inventoryId: string;
  url: string;
  title: string | null;
  status: "covered" | "partial";
  /** Abschnitt, der das Topic abdeckt */
  heading: string | null;
  similarity: number;
  /** Link von der Mapping-URL hierher; undefined = nicht geprüft, null = kein Link gefunden */
  link?: TopicLink | null;
}

export interface TopicLink {
  anchor: string;
  /** false = nur in Navigation, Header oder Footer verlinkt */
  inContent: boolean;
}

export interface TopicGapItem {
  topic: string;
  path: string[];
  status: TopicCoverageStatus;
  reason: string;
  evidence: string | null;
  /** Für die Übergabe in den SEO KVP ausgewählt */
  selected?: boolean;
  /** Im Redaktionsplan angelegter Artikel zu diesem Topic */
  editorialArticleId?: string;
  /** Abgleich mit dem Content-Mapping (nur bei missing/partial); leer = geprüft, nichts gefunden */
  otherUrls?: TopicOtherUrl[];
}

export interface TopicGapSummaryDto {
  id: string;
  status: string;
  coverageScore: number | null;
  missingCount: number;
  partialCount: number;
  selectedCount: number;
  focusKeyword: string;
  /** Verknüpfter Kanban-Task; kann auf einen inzwischen gelöschten Task zeigen */
  taskId: string | null;
  createdAt: string;
}

export interface MapUrlDto {
  id: string;
  url: string;
  h1: string | null;
  noindex: boolean;
  statusCode: number | null;
  navigationType: string | null;
  pageType: string | null;
  funnel: string | null;
  targetGroup: string | null;
  topicAuthority: string | null;
  ctas: MapCta[];
  furtherLinks: string[];
  dfsTopKeyword: string | null;
  dfsSearchVolume: number | null;
  dfsRank: number | null;
  dfsFetchedAt: string | null;
  manualRank: string | null;
  gscClicks: number | null;
  comment: string | null;
  kvpUrlId: string | null;
  focusKeyword: MapKeywordDto | null;
  subKeywords: MapKeywordDto[];
  /** Summe der Subkeyword-Suchvolumen (Einzelwerte, sonst Import-Summe) */
  subSearchVolume: number | null;
  latestTopicGap: TopicGapSummaryDto | null;
  score: number | null;
  updatedAt: string;
}

export interface MapProjectDto {
  id: string;
  name: string;
  category: string | null;
  countryCode: string;
  languageCode: string;
  dropdownOptions: DropdownOptions;
  urlCount: number;
  focusCount: number;
  kvpCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Felder, die per PATCH an einer URL bearbeitet werden dürfen. */
export const EDITABLE_URL_FIELDS = [
  "url",
  "h1",
  "noindex",
  "statusCode",
  "navigationType",
  "pageType",
  "funnel",
  "targetGroup",
  "topicAuthority",
  "ctas",
  "furtherLinks",
  "subSearchVolume",
  "manualRank",
  "gscClicks",
  "comment",
] as const;

/** Entfernt Zero-Width-Zeichen und überflüssige Leerzeichen (kommen in den Excel-Vorlagen vor). */
export function cleanText(value: string): string {
  return value.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/[ \t\u00A0]+/g, " ").trim();
}

export function normalizeKeyword(value: string): string {
  return cleanText(value).toLowerCase();
}

export function splitKeywords(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(/[,;\n]/)) {
    const kw = normalizeKeyword(part);
    if (!kw || kw === "-" || seen.has(kw)) continue;
    seen.add(kw);
    out.push(kw);
  }
  return out;
}

export function parseRank(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  if (!value) return null;
  const m = String(value).match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return n > 0 ? n : null;
}

/** Ranking für Score und KPIs: manuelle Abfrage hat Vorrang vor DataForSEO. */
export function effectiveRank(url: Pick<MapUrlDto, "manualRank" | "dfsRank">): number | null {
  return parseRank(url.manualRank) ?? url.dfsRank ?? null;
}

/**
 * Priorisierungs-Score 1–10 aus den bisherigen Excel-Mappings:
 * hohes Suchvolumen (log-skaliert relativ zum Projektmaximum) und schwaches Ranking ergeben einen hohen Score.
 * Ohne Ranking kein Score.
 */
export function computeScore(totalSv: number, rank: number | null, maxTotalSv: number): number | null {
  if (rank === null || rank < 1) return null;
  const denom = Math.log10(maxTotalSv + 1);
  const svFactor = denom > 0 ? Math.log10(totalSv + 1) / denom : 0;
  const rankFactor = 0.25 + 0.75 * Math.sqrt((Math.min(rank, 101) - 1) / 100);
  return Math.round((1 + 9 * svFactor * rankFactor) * 10) / 10;
}

export function totalSearchVolume(url: Pick<MapUrlDto, "focusKeyword" | "subSearchVolume">): number {
  return (url.focusKeyword?.searchVolume ?? 0) + (url.subSearchVolume ?? 0);
}

/** Wählt aus den DataForSEO-Rankings das Top-Keyword: höchstes Suchvolumen in den Top 20, sonst bestes Ranking. */
/** Ein Keyword kann mehrfach ranken (z.B. verschiedene SERP-Elemente) – behalten wird die beste Position. */
export function dedupeDfsKeywords(rows: DfsKeywordRow[]): DfsKeywordRow[] {
  const best = new Map<string, DfsKeywordRow>();
  for (const row of rows) {
    const key = normalizeKeyword(row.keyword);
    if (!key) continue;
    const prev = best.get(key);
    if (!prev || (row.rankGroup || 999) < (prev.rankGroup || 999)) {
      best.set(key, { ...row, keyword: key, searchVolume: row.searchVolume ?? prev?.searchVolume ?? null });
    }
  }
  return [...best.values()];
}

export function pickTopKeyword(rows: DfsKeywordRow[]): DfsKeywordRow | null {
  if (rows.length === 0) return null;
  const top20 = rows.filter((r) => r.rankGroup > 0 && r.rankGroup <= 20);
  const pool = top20.length > 0 ? top20 : rows;
  return [...pool].sort(
    (a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0) || (a.rankGroup || 999) - (b.rankGroup || 999)
  )[0];
}

export interface ProjectKpis {
  urls: number;
  focusSv: number;
  subSv: number;
  gscClicks: number;
  avgRank: number | null;
  top10Share: number | null;
  focusFilled: number;
  topicAuthorityFilled: number;
  ctaFilled: number;
  inKvp: number;
}

export function computeKpis(urls: MapUrlDto[]): ProjectKpis {
  let focusSv = 0;
  let subSv = 0;
  let gscClicks = 0;
  let rankSum = 0;
  let rankCount = 0;
  let top10 = 0;
  let focusFilled = 0;
  let topicAuthorityFilled = 0;
  let ctaFilled = 0;
  let inKvp = 0;
  for (const u of urls) {
    focusSv += u.focusKeyword?.searchVolume ?? 0;
    subSv += u.subSearchVolume ?? 0;
    gscClicks += u.gscClicks ?? 0;
    const rank = effectiveRank(u);
    if (rank !== null) {
      rankSum += rank;
      rankCount++;
      if (rank <= 10) top10++;
    }
    if (u.focusKeyword) focusFilled++;
    if (u.topicAuthority) topicAuthorityFilled++;
    if (u.ctas.some((c) => c.label || c.link)) ctaFilled++;
    if (u.kvpUrlId) inKvp++;
  }
  return {
    urls: urls.length,
    focusSv,
    subSv,
    gscClicks,
    avgRank: rankCount ? rankSum / rankCount : null,
    top10Share: rankCount ? top10 / rankCount : null,
    focusFilled,
    topicAuthorityFilled,
    ctaFilled,
    inKvp,
  };
}
