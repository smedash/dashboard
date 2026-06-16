// DataForSEO API Integration für Rank Tracking

const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

const ALLOWED_CHARS_RE = /[^\p{L}\p{N}\s\-.:\/]/gu;
const MAX_KEYWORD_WORDS = 5;

function sanitizeKeyword(kw: string): string {
  const cleaned = kw.replace(ALLOWED_CHARS_RE, " ").replace(/\s+/g, " ").trim();
  if (cleaned.split(" ").length > MAX_KEYWORD_WORDS) {
    return "";
  }
  return cleaned;
}

// Base64 encode credentials for Basic Auth
function getAuthHeader(): string {
  const username = process.env.DATAFORSEO_USERNAME;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!username || !password) {
    throw new Error("DATAFORSEO_USERNAME und DATAFORSEO_PASSWORD müssen in der .env Datei gesetzt sein");
  }

  const credentials = `${username}:${password}`;
  const encoded = Buffer.from(credentials).toString("base64");
  return `Basic ${encoded}`;
}

export interface RankTrackerTask {
  keyword: string;
  location_name?: string;
  location_code?: number;
  language_name?: string;
  language_code?: string;
  se_domain?: string;
  target?: string;
  tag?: string;
  depth?: number; // Anzahl der Suchergebnisse (Standard: 10, Max: 700)
}

export interface RankTrackerResult {
  keyword: string;
  location_name: string;
  language_name: string;
  check_url: string;
  datetime: string;
  items_count: number;
  items: Array<{
    type: string;
    rank_group: number;
    rank_absolute: number;
    position: string;
    xpath: string;
    domain: string;
    title: string;
    url: string;
    breadcrumb: string;
    website_name: string;
    is_featured_snippet: boolean;
    is_paid: boolean;
  }>;
}

/**
 * Erstellt eine neue Rank Tracker Task bei DataForSEO
 */
export async function createRankTrackerTask(
  tasks: RankTrackerTask[]
): Promise<{
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
  }>;
}> {
  const response = await fetch(`${DATAFORSEO_API_URL}/serp/google/organic/task_post`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tasks),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Ruft die Ergebnisse einer Rank Tracker Task ab
 */
export async function getRankTrackerResults(
  taskIds: string[]
): Promise<{
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    result: RankTrackerResult[] | null;
  }>;
}> {
  console.log(`[getRankTrackerResults] Rufe Ergebnisse für ${taskIds.length} Tasks ab:`, taskIds);
  
  const response = await fetch(`${DATAFORSEO_API_URL}/serp/google/organic/task_get/advanced/${taskIds.join(",")}`, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[getRankTrackerResults] API Fehler: ${response.status} - ${errorText}`);
    throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`[getRankTrackerResults] API Response:`, {
    tasksCount: data.tasks?.length || 0,
    requestedTaskIds: taskIds.length,
    returnedTaskIds: data.tasks?.map((t: any) => t.id) || [],
  });
  
  return data;
}

/**
 * Ruft Rankings für Keywords ab - verwendet den LIVE Endpunkt für sofortige Ergebnisse
 */
export async function fetchRankings(
  keywords: Array<{ keyword: string; targetUrl?: string | null }>,
  location: string = "Switzerland",
  language: string = "German"
): Promise<RankTrackerResult[]> {
  // ERZWINGE IMMER Schweiz - ignoriere übergebene Location
  const forcedLocation = "Switzerland";
  const forcedLanguage = language || "German";
  
  console.log(`[fetchRankings] Location Parameter: "${location}", ERZWUNGEN: "${forcedLocation}"`);
  
  const locationCodeMap: Record<string, number> = {
    Switzerland: 2756,
    Germany: 2276,
    "United States": 2840,
  };
  
  const languageCodeMap: Record<string, string> = {
    German: "de",
    English: "en",
    French: "fr",
    Italian: "it",
  };

  const locationCode = locationCodeMap[forcedLocation] || 2756;
  const languageCode = languageCodeMap[forcedLanguage] || "de";
  
  console.log(`[fetchRankings] Verwende Location Code: ${locationCode} (Schweiz), Language Code: ${languageCode}`);
  console.log(`[fetchRankings] Verarbeite ${keywords.length} Keywords mit LIVE API...`);

  const allResults: RankTrackerResult[] = [];
  
  // Verarbeite jedes Keyword einzeln mit dem Live-Endpunkt
  for (let i = 0; i < keywords.length; i++) {
    const item = keywords[i];
    console.log(`[fetchRankings] ====== Keyword ${i + 1}/${keywords.length}: "${item.keyword}" ======`);
    
    try {
      const requestBody = [{
        keyword: item.keyword,
        location_code: locationCode,
        language_code: languageCode,
        depth: 50,
      }];
      
      console.log(`[fetchRankings] Sende Live-Request für "${item.keyword}"...`);
      
      const response = await fetch(`${DATAFORSEO_API_URL}/serp/google/organic/live/advanced`, {
        method: "POST",
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fetchRankings] API Fehler für "${item.keyword}": ${response.status} - ${errorText}`);
        continue; // Weiter mit nächstem Keyword
      }

      const data = await response.json();
      
      if (data.tasks && data.tasks.length > 0) {
        const task = data.tasks[0];
        console.log(`[fetchRankings] Response für "${item.keyword}": Status ${task.status_code} (${task.status_message})`);
        
        if (task.status_code === 20000 && task.result && task.result.length > 0) {
          const result = task.result[0];
          console.log(`[fetchRankings] ✓ "${item.keyword}": ${result.items_count} Items gefunden`);
          
          // Logge die ersten 5 Items
          if (result.items && result.items.length > 0) {
            console.log(`[fetchRankings] Top 5 Items für "${item.keyword}":`, 
              result.items.slice(0, 5).map((item: { rank_absolute: number; domain: string; url: string }) => ({
                rank: item.rank_absolute,
                domain: item.domain,
                url: item.url?.substring(0, 60)
              }))
            );
          }
          
          allResults.push(result);
        } else {
          console.warn(`[fetchRankings] ✗ Keine Ergebnisse für "${item.keyword}": ${task.status_message}`);
        }
      }
      
      // Kurze Pause zwischen Requests um Rate-Limits zu vermeiden
      if (i < keywords.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      console.error(`[fetchRankings] Fehler bei "${item.keyword}":`, error);
      // Weiter mit nächstem Keyword
    }
  }
  
  console.log(`[fetchRankings] ====== Alle Keywords verarbeitet ======`);
  console.log(`[fetchRankings] Gesamt Results: ${allResults.length} für ${keywords.length} Keywords`);
  console.log(`[fetchRankings] Results Keywords:`, allResults.map(r => r.keyword));
  
  if (allResults.length > 0) {
    console.log(`[fetchRankings] ✓ Erfolgreich ${allResults.length} Results abgerufen`);
    return allResults;
  }

  console.error(`[fetchRankings] ✗ Keine Results abgerufen`);
  throw new Error("Keine Rankings gefunden");
}

// ==========================================
// SEARCH VOLUME API
// ==========================================

export interface SearchVolumeResult {
  keyword: string;
  search_volume: number | null;
  competition: string | null;
  competition_index: number | null;
  cpc: number | null;
  low_top_of_page_bid: number | null;
  high_top_of_page_bid: number | null;
  monthly_searches: Array<{
    year: number;
    month: number;
    search_volume: number;
  }> | null;
}

/**
 * Ruft das Suchvolumen für Keywords ab - verwendet den LIVE Endpunkt
 * Basiert auf: https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/
 * HINWEIS: Location wird IMMER auf Schweiz gesetzt, unabhängig vom übergebenen Parameter
 */
export async function fetchSearchVolume(
  keywords: string[],
  location: string = "Switzerland",
  language: string = "German"
): Promise<SearchVolumeResult[]> {
  // ERZWINGE IMMER Schweiz - ignoriere übergebene Location (wie bei fetchRankings)
  const forcedLocation = "Switzerland";
  const forcedLanguage = language || "German";

  // Location und Language Codes
  const locationCodeMap: Record<string, number> = {
    Switzerland: 2756,
    Germany: 2276,
    "United States": 2840,
  };

  const languageCodeMap: Record<string, string> = {
    German: "de",
    English: "en",
    French: "fr",
    Italian: "it",
  };

  const locationCode = locationCodeMap[forcedLocation] || 2756;
  const languageCode = languageCodeMap[forcedLanguage] || "de";

  console.log(`[fetchSearchVolume] Rufe Suchvolumen für ${keywords.length} Keywords ab`);
  console.log(`[fetchSearchVolume] Location Parameter: "${location}", ERZWUNGEN: "${forcedLocation}"`);
  console.log(`[fetchSearchVolume] Location Code: ${locationCode} (Schweiz), Language Code: ${languageCode}`);

  // Die API unterstützt maximal 1000 Keywords pro Request
  // Wir teilen die Keywords in Batches von 100 auf
  const batchSize = 100;
  const allResults: SearchVolumeResult[] = [];

  const MAX_RETRIES = 3;

  for (let i = 0; i < keywords.length; i += batchSize) {
    const rawBatch = keywords.slice(i, i + batchSize);
    const cleanedToOriginals = new Map<string, string[]>();
    const batch: string[] = [];

    for (const kw of rawBatch) {
      const cleaned = sanitizeKeyword(kw);
      if (!cleaned) continue;
      if (!cleanedToOriginals.has(cleaned)) {
        cleanedToOriginals.set(cleaned, []);
        batch.push(cleaned);
      }
      if (kw !== cleaned) {
        cleanedToOriginals.get(cleaned)!.push(kw);
      }
    }

    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(keywords.length / batchSize);
    if (batch.length === 0) {
      continue;
    }
    console.log(`[fetchSearchVolume] Verarbeite Batch ${batchNum}/${totalBatches} (${batch.length} Keywords)`);

    let lastError = "";
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const requestBody = [{
          keywords: batch,
          location_code: 2756,
          location_name: "Switzerland",
          language_code: "de",
          language_name: "German",
        }];

        const response = await fetch(`${DATAFORSEO_API_URL}/keywords_data/google_ads/search_volume/live`, {
          method: "POST",
          headers: {
            Authorization: getAuthHeader(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (response.status === 429) {
          const wait = Math.min(2000 * 2 ** attempt, 30_000);
          console.warn(`[fetchSearchVolume] Rate limited bei Batch ${batchNum}, warte ${wait}ms (Versuch ${attempt + 1}/${MAX_RETRIES + 1})`);
          await new Promise((r) => setTimeout(r, wait));
          lastError = "Rate limit exceeded";
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          const isRateLimit = errorText.includes("rate") || errorText.includes("limit");
          if (isRateLimit && attempt < MAX_RETRIES) {
            const wait = Math.min(2000 * 2 ** attempt, 30_000);
            console.warn(`[fetchSearchVolume] Rate limit in Body bei Batch ${batchNum}, warte ${wait}ms`);
            await new Promise((r) => setTimeout(r, wait));
            lastError = errorText.slice(0, 200);
            continue;
          }
          console.error(`[fetchSearchVolume] API Fehler bei Batch ${batchNum}: ${response.status} - ${errorText.slice(0, 200)}`);
          break;
        }

        const data = await response.json();

        if (data.tasks && data.tasks.length > 0) {
          const task = data.tasks[0];
          const taskMsg = task.status_message ?? "";
          if (taskMsg.toLowerCase().includes("rate") && taskMsg.toLowerCase().includes("limit") && attempt < MAX_RETRIES) {
            const wait = Math.min(2000 * 2 ** attempt, 30_000);
            console.warn(`[fetchSearchVolume] Rate limit in Task bei Batch ${batchNum}, warte ${wait}ms`);
            await new Promise((r) => setTimeout(r, wait));
            lastError = taskMsg;
            continue;
          }

          console.log(`[fetchSearchVolume] Batch ${batchNum} Response Status: ${task.status_code} (${taskMsg})`);

          if (task.status_code === 20000 && task.result && task.result.length > 0) {
            const results = task.result as (SearchVolumeResult & { location_code?: number })[];
            console.log(`[fetchSearchVolume] ✓ Batch ${batchNum}: ${results.length} Suchvolumen-Ergebnisse erhalten`);
            for (const result of results) {
              allResults.push(result);
              const originals = cleanedToOriginals.get(result.keyword);
              if (originals) {
                for (const orig of originals) {
                  allResults.push({ ...result, keyword: orig });
                }
              }
            }
          } else {
            console.warn(`[fetchSearchVolume] ✗ Batch ${batchNum}: Keine Ergebnisse: ${taskMsg}`);
          }
        }

        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unbekannter Fehler";
        if (attempt < MAX_RETRIES) {
          const wait = Math.min(2000 * 2 ** attempt, 30_000);
          console.warn(`[fetchSearchVolume] Fehler bei Batch ${batchNum}, Retry in ${wait}ms: ${lastError}`);
          await new Promise((r) => setTimeout(r, wait));
        } else {
          console.error(`[fetchSearchVolume] Batch ${batchNum} endgueltig fehlgeschlagen nach ${MAX_RETRIES + 1} Versuchen: ${lastError}`);
        }
      }
    }

    if (i + batchSize < keywords.length) {
      await new Promise((resolve) => setTimeout(resolve, 6000));
    }
  }

  console.log(`[fetchSearchVolume] ====== Fertig ======`);
  console.log(`[fetchSearchVolume] Gesamt: ${allResults.length} Ergebnisse für ${keywords.length} Keywords`);

  return allResults;
}

// ==========================================
// BACKLINKS API
// ==========================================

export interface BacklinkItem {
  type: string;
  domain_from: string;
  url_from: string;
  url_from_https: boolean;
  domain_to: string;
  url_to: string;
  url_to_https: boolean;
  tld_from: string;
  is_new: boolean;
  is_lost: boolean;
  backlink_spam_score: number;
  rank: number;
  page_from_rank: number;
  domain_from_rank: number;
  domain_from_platform_type: string[] | null;
  domain_from_is_ip: boolean;
  domain_from_ip: string | null;
  domain_from_country: string | null;
  page_from_external_links: number;
  page_from_internal_links: number;
  page_from_size: number;
  page_from_encoding: string | null;
  page_from_language: string | null;
  page_from_title: string | null;
  page_from_status_code: number;
  first_seen: string;
  prev_seen: string | null;
  last_seen: string;
  item_type: string;
  attributes: string[] | null;
  dofollow: boolean;
  original: boolean;
  alt: string | null;
  image_url: string | null;
  anchor: string | null;
  text_pre: string | null;
  text_post: string | null;
  semantic_location: string | null;
  links_count: number;
  group_count: number;
  is_broken: boolean;
  url_to_status_code: number;
  url_to_spam_score: number;
  url_to_redirect_target: string | null;
  ranked_keywords_info: {
    page_from_keywords_count_top_3: number;
    page_from_keywords_count_top_10: number;
    page_from_keywords_count_top_100: number;
  } | null;
  is_indirect_link: boolean;
  indirect_link_path: string[] | null;
}

export interface BacklinksSummary {
  target: string;
  total_backlinks: number;
  total_referring_domains: number;
  total_referring_main_domains: number;
  total_referring_ips: number;
  total_referring_subnets: number;
  dofollow: number;
  nofollow: number;
  new_backlinks: number;
  lost_backlinks: number;
}

export interface BacklinksResult {
  target: string;
  total_count: number;
  items_count: number;
  items: BacklinkItem[];
}

/**
 * Ruft das Backlink-Profil für ubs.com ab
 * Verwendet den Backlinks Live Endpunkt: https://docs.dataforseo.com/v3/backlinks/backlinks/live/
 */
export async function fetchBacklinks(
  limit: number = 100,
  offset: number = 0,
  orderBy: string = "rank,desc",
  filters?: { dofollow?: boolean; isLost?: boolean; isNew?: boolean }
): Promise<BacklinksResult> {
  // Target ist IMMER ubs.com - keine andere Domain erlaubt
  const target = "ubs.com";
  
  console.log(`[fetchBacklinks] Rufe Backlinks für ${target} ab (Limit: ${limit}, Offset: ${offset})`);

  // Baue Filter-Array auf
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterArray: any[] = [];
  
  if (filters?.dofollow !== undefined) {
    filterArray.push(["dofollow", "=", filters.dofollow]);
  }
  
  if (filters?.isLost !== undefined) {
    filterArray.push(["is_lost", "=", filters.isLost]);
  }
  
  if (filters?.isNew !== undefined) {
    filterArray.push(["is_new", "=", filters.isNew]);
  }

  const requestBody = [{
    target,
    limit,
    offset,
    order_by: [orderBy],
    backlinks_status_type: "live",
    include_subdomains: true,
    ...(filterArray.length > 0 ? { filters: filterArray } : {}),
  }];

  console.log(`[fetchBacklinks] Request Body:`, JSON.stringify(requestBody, null, 2));

  const response = await fetch(`${DATAFORSEO_API_URL}/backlinks/backlinks/live`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[fetchBacklinks] API Fehler: ${response.status} - ${errorText}`);
    throw new Error(`DataForSEO Backlinks API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.tasks && data.tasks.length > 0) {
    const task = data.tasks[0];
    console.log(`[fetchBacklinks] Response Status: ${task.status_code} (${task.status_message})`);

    if (task.status_code === 20000 && task.result && task.result.length > 0) {
      const result = task.result[0];
      console.log(`[fetchBacklinks] ✓ ${result.items_count} Backlinks von ${result.total_count} gesamt abgerufen`);
      
      return result;
    } else {
      console.warn(`[fetchBacklinks] ✗ Keine Ergebnisse: ${task.status_message}`);
      throw new Error(`Keine Backlinks gefunden: ${task.status_message}`);
    }
  }

  throw new Error("Unerwartete API-Antwort");
}

/**
 * Ruft eine Zusammenfassung des Backlink-Profils für ubs.com ab
 * Verwendet den Backlinks Summary Endpunkt
 */
export async function fetchBacklinksSummary(): Promise<BacklinksSummary> {
  // Target ist IMMER ubs.com - keine andere Domain erlaubt
  const target = "ubs.com";
  
  console.log(`[fetchBacklinksSummary] Rufe Backlinks-Summary für ${target} ab`);

  const requestBody = [{
    target,
    include_subdomains: true,
  }];

  const response = await fetch(`${DATAFORSEO_API_URL}/backlinks/summary/live`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[fetchBacklinksSummary] API Fehler: ${response.status} - ${errorText}`);
    throw new Error(`DataForSEO Backlinks Summary API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.tasks && data.tasks.length > 0) {
    const task = data.tasks[0];
    console.log(`[fetchBacklinksSummary] Response Status: ${task.status_code} (${task.status_message})`);

    if (task.status_code === 20000 && task.result && task.result.length > 0) {
      const result = task.result[0];
      console.log(`[fetchBacklinksSummary] ✓ Summary abgerufen:`, {
        total_backlinks: result.backlinks,
        referring_domains: result.referring_domains,
        dofollow: result.backlinks_dofollow,
        nofollow: result.backlinks_nofollow,
      });
      
      return {
        target,
        total_backlinks: result.backlinks || 0,
        total_referring_domains: result.referring_domains || 0,
        total_referring_main_domains: result.referring_main_domains || 0,
        total_referring_ips: result.referring_ips || 0,
        total_referring_subnets: result.referring_subnets || 0,
        dofollow: result.backlinks_dofollow || 0,
        nofollow: result.backlinks_nofollow || 0,
        new_backlinks: result.backlinks_new || 0,
        lost_backlinks: result.backlinks_lost || 0,
      };
    } else {
      console.warn(`[fetchBacklinksSummary] ✗ Keine Ergebnisse: ${task.status_message}`);
      throw new Error(`Keine Backlinks-Summary gefunden: ${task.status_message}`);
    }
  }

  throw new Error("Unerwartete API-Antwort");
}

/**
 * Ruft Referring Domains für ubs.com ab
 */
export async function fetchReferringDomains(
  limit: number = 100,
  offset: number = 0,
  orderBy: string = "rank,desc"
): Promise<{ total_count: number; items_count: number; items: Array<{
  type: string;
  domain: string;
  rank: number;
  backlinks: number;
  first_seen: string;
  lost_date: string | null;
  backlinks_spam_score: number;
  broken_backlinks: number;
  broken_pages: number;
  referring_ips: number;
  referring_subnets: number;
  referring_pages: number;
  referring_links_tld: Record<string, number> | null;
  referring_links_types: Record<string, number> | null;
  referring_links_attributes: Record<string, number> | null;
  referring_links_platform_types: Record<string, number> | null;
  referring_links_semantic_locations: Record<string, number> | null;
  referring_links_countries: Record<string, number> | null;
}> }> {
  // Target ist IMMER ubs.com - keine andere Domain erlaubt
  const target = "ubs.com";
  
  console.log(`[fetchReferringDomains] Rufe Referring Domains für ${target} ab (Limit: ${limit}, Offset: ${offset})`);

  const requestBody = [{
    target,
    limit,
    offset,
    order_by: [orderBy],
    include_subdomains: true,
  }];

  const response = await fetch(`${DATAFORSEO_API_URL}/backlinks/referring_domains/live`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[fetchReferringDomains] API Fehler: ${response.status} - ${errorText}`);
    throw new Error(`DataForSEO Referring Domains API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.tasks && data.tasks.length > 0) {
    const task = data.tasks[0];
    console.log(`[fetchReferringDomains] Response Status: ${task.status_code} (${task.status_message})`);

    if (task.status_code === 20000 && task.result && task.result.length > 0) {
      const result = task.result[0];
      console.log(`[fetchReferringDomains] ✓ ${result.items_count} Referring Domains von ${result.total_count} gesamt abgerufen`);
      
      return result;
    } else {
      console.warn(`[fetchReferringDomains] ✗ Keine Ergebnisse: ${task.status_message}`);
      throw new Error(`Keine Referring Domains gefunden: ${task.status_message}`);
    }
  }

  throw new Error("Unerwartete API-Antwort");
}

/** Top-Rank-Keywords pro Seiten-URL (DataForSEO Labs, wöchentlich aktualisiert). */
export type LabsRankedKeywordItem = {
  keyword: string;
  rankGroup: number;
  rankAbsolute: number | null;
  searchVolume: number | null;
};

export type LabsRankedKeywordsTaskResult = {
  keywords: LabsRankedKeywordItem[];
  error?: string;
};

type RankedKeywordsLiveTask = {
  status_code: number;
  status_message?: string;
  data?: { tag?: string; target?: string };
  result?: Array<{
    items?: Array<{
      keyword_data?: {
        keyword?: string;
        keyword_info?: { search_volume?: number };
      };
      ranked_serp_element?: {
        serp_item?: {
          type?: string;
          rank_group?: number;
          rank_absolute?: number;
          is_paid?: boolean;
        };
      };
    }>;
  }>;
};

function parseRankedKeywordsLiveTask(
  task: RankedKeywordsLiveTask | undefined,
  limit: number
): LabsRankedKeywordsTaskResult {
  if (!task) {
    return { keywords: [], error: "Keine Task-Antwort" };
  }

  if (task.status_code !== 20000) {
    return {
      keywords: [],
      error: task.status_message || `Status ${task.status_code}`,
    };
  }

  const rawItems = task.result?.[0]?.items ?? [];
  const keywords: LabsRankedKeywordItem[] = [];

  for (const item of rawItems) {
    const kw = item.keyword_data?.keyword;
    if (!kw) continue;
    const serp = item.ranked_serp_element?.serp_item;
    if (serp?.type && serp.type !== "organic") continue;
    if (serp?.is_paid) continue;
    keywords.push({
      keyword: kw,
      rankGroup: typeof serp?.rank_group === "number" ? serp.rank_group : 0,
      rankAbsolute: typeof serp?.rank_absolute === "number" ? serp.rank_absolute : null,
      searchVolume:
        typeof item.keyword_data?.keyword_info?.search_volume === "number"
          ? item.keyword_data.keyword_info.search_volume
          : null,
    });
    if (keywords.length >= limit) break;
  }

  return { keywords };
}

/**
 * DataForSEO Labs: ranked_keywords/live — Keywords, für die die Ziel-URL organisch rankt.
 * Pro HTTP-Request nur **eine** Task (API: „You can set only one task at a time.“).
 * @param tasks je Eintrag: `tag` zur Zuordnung (z. B. Artikel-ID), `target` volle URL mit https://
 * @see https://docs.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live/
 */
export async function fetchRankedKeywordsForPageTargets(
  tasks: Array<{ tag: string; target: string }>,
  options?: { limit?: number; concurrency?: number }
): Promise<Map<string, LabsRankedKeywordsTaskResult>> {
  const limit = Math.min(Math.max(options?.limit ?? 5, 1), 1000);
  const concurrency = Math.min(Math.max(options?.concurrency ?? 4, 1), 10);
  const locationName = process.env.DATAFORSEO_LABS_LOCATION_NAME?.trim();
  const languageName = process.env.DATAFORSEO_LABS_LANGUAGE_NAME?.trim();

  const out = new Map<string, LabsRankedKeywordsTaskResult>();
  for (const t of tasks) {
    out.set(t.tag, { keywords: [] });
  }

  let nextIndex = 0;
  const MAX_RETRIES = 3;

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= tasks.length) return;
      const { tag, target } = tasks[i];

      const body: Record<string, unknown> = {
        target,
        tag,
        limit,
        item_types: ["organic"],
        order_by: ["ranked_serp_element.serp_item.rank_group,asc"],
      };
      if (locationName) body.location_name = locationName;
      if (languageName) body.language_name = languageName;

      let lastError = "";
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await fetch(
            `${DATAFORSEO_API_URL}/dataforseo_labs/google/ranked_keywords/live`,
            {
              method: "POST",
              headers: {
                Authorization: getAuthHeader(),
                "Content-Type": "application/json",
              },
              body: JSON.stringify([body]),
            }
          );

          if (response.status === 429) {
            const wait = Math.min(2000 * 2 ** attempt, 30_000);
            await new Promise((r) => setTimeout(r, wait));
            lastError = "Rate limit exceeded";
            continue;
          }

          if (!response.ok) {
            const errorText = await response.text();
            const isRateLimit = errorText.includes("rates limit") || errorText.includes("rate limit");
            if (isRateLimit && attempt < MAX_RETRIES) {
              const wait = Math.min(2000 * 2 ** attempt, 30_000);
              await new Promise((r) => setTimeout(r, wait));
              lastError = errorText.slice(0, 200);
              continue;
            }
            out.set(tag, {
              keywords: [],
              error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
            });
            break;
          }

          const data = (await response.json()) as { tasks?: RankedKeywordsLiveTask[] };
          const taskResult = data.tasks?.[0];
          const taskStatusMsg = taskResult?.status_message ?? "";
          if (taskStatusMsg.toLowerCase().includes("rate") && taskStatusMsg.toLowerCase().includes("limit") && attempt < MAX_RETRIES) {
            const wait = Math.min(2000 * 2 ** attempt, 30_000);
            await new Promise((r) => setTimeout(r, wait));
            lastError = taskStatusMsg;
            continue;
          }

          const parsed = parseRankedKeywordsLiveTask(taskResult, limit);
          out.set(tag, parsed);
          break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : "Unbekannter Fehler";
          if (attempt === MAX_RETRIES) {
            out.set(tag, { keywords: [], error: lastError });
          }
        }
      }
      if (!out.has(tag)) {
        out.set(tag, { keywords: [], error: lastError || "Max retries exceeded" });
      }
    }
  }

  const pool = Math.min(concurrency, tasks.length || 1);
  await Promise.all(Array.from({ length: pool }, () => worker()));

  return out;
}

// ==========================================
// GOOGLE TRENDS API
// ==========================================

export interface GoogleTrendResult {
  keyword: string;
  trendAvg: number | null;
  trendRecent: number | null;
  trendDirection: "up" | "down" | "stable" | null;
}

/**
 * Ruft Google Trends Daten fuer Keywords ab via DataForSEO Explore Live.
 * Jedes Keyword wird einzeln abgefragt fuer konsistente 0-100 Scores.
 *
 * DataForSEO Google Trends Explore hat hohe Latenz (40-50s typisch, Timeout 120s).
 * Wir setzen fetch-Timeout auf 130s und retrien bei 500ern (Systemlast).
 *
 * @see https://docs.dataforseo.com/v3/keywords_data/google_trends/explore/live/
 */
export async function fetchGoogleTrends(
  keywords: string[],
  options?: {
    location_name?: string;
    language_name?: string;
    time_range?: string;
    concurrency?: number;
  }
): Promise<GoogleTrendResult[]> {
  const locationName = options?.location_name ?? "Switzerland";
  const languageName = options?.language_name ?? "German";
  const timeRange = options?.time_range ?? "past_12_months";
  const concurrency = Math.min(Math.max(options?.concurrency ?? 5, 1), 10);

  const FETCH_TIMEOUT_MS = 130_000;
  const MAX_RETRIES = 2;

  console.log(`[fetchGoogleTrends] ${keywords.length} Keywords, Location: ${locationName}, Language: ${languageName}, Concurrency: ${concurrency}`);

  const results: GoogleTrendResult[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= keywords.length) return;
      const originalKeyword = keywords[i];
      const keyword = sanitizeKeyword(originalKeyword);
      if (!keyword) {
        results.push({ keyword: originalKeyword, trendAvg: null, trendRecent: null, trendDirection: null });
        continue;
      }

      let lastError = "";
      let success = false;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const requestBody = [{
            keywords: [keyword],
            location_name: locationName,
            language_name: languageName,
            time_range: timeRange,
            item_types: ["google_trends_graph"],
          }];

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

          let response: Response;
          try {
            response = await fetch(
              `${DATAFORSEO_API_URL}/keywords_data/google_trends/explore/live`,
              {
                method: "POST",
                headers: {
                  Authorization: getAuthHeader(),
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
              }
            );
          } finally {
            clearTimeout(timeout);
          }

          if (response.status === 429) {
            const wait = Math.min(5000 * 2 ** attempt, 30_000);
            console.warn(`[fetchGoogleTrends] Rate limited fuer "${keyword}", warte ${wait}ms (Versuch ${attempt + 1}/${MAX_RETRIES + 1})`);
            await new Promise((r) => setTimeout(r, wait));
            lastError = "Rate limit";
            continue;
          }

          if (response.status >= 500) {
            const errorText = await response.text().catch(() => "");
            const wait = Math.min(10_000 * 2 ** attempt, 60_000);
            console.warn(`[fetchGoogleTrends] HTTP ${response.status} fuer "${keyword}" (Systemlast), Retry in ${wait}ms (Versuch ${attempt + 1}/${MAX_RETRIES + 1}): ${errorText.slice(0, 150)}`);
            await new Promise((r) => setTimeout(r, wait));
            lastError = `HTTP ${response.status}`;
            continue;
          }

          if (!response.ok) {
            console.warn(`[fetchGoogleTrends] HTTP ${response.status} fuer "${keyword}"`);
            lastError = `HTTP ${response.status}`;
            break;
          }

          const data = await response.json();
          const task = data.tasks?.[0];

          if (task?.status_code !== 20000 || !task.result?.[0]?.items?.length) {
            results.push({ keyword: originalKeyword, trendAvg: null, trendRecent: null, trendDirection: null });
            success = true;
            break;
          }

          const graphItem = task.result[0].items.find(
            (it: { type: string }) => it.type === "google_trends_graph"
          );

          if (!graphItem?.data?.length) {
            results.push({ keyword: originalKeyword, trendAvg: null, trendRecent: null, trendDirection: null });
            success = true;
            break;
          }

          const values: number[] = graphItem.data
            .map((d: { values: (number | null)[] }) => d.values?.[0])
            .filter((v: number | null): v is number => v !== null && v !== undefined);

          if (values.length === 0) {
            results.push({ keyword: originalKeyword, trendAvg: null, trendRecent: null, trendDirection: null });
            success = true;
            break;
          }

          const avg = Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length);
          const recentSlice = values.slice(-4);
          const olderSlice = values.slice(0, 4);
          const recentAvg = recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length;
          const olderAvg = olderSlice.length > 0
            ? olderSlice.reduce((a, b) => a + b, 0) / olderSlice.length
            : recentAvg;

          const diff = recentAvg - olderAvg;
          const threshold = Math.max(olderAvg * 0.15, 5);
          const direction: "up" | "down" | "stable" =
            diff > threshold ? "up" : diff < -threshold ? "down" : "stable";

          results.push({
            keyword: originalKeyword,
            trendAvg: avg,
            trendRecent: Math.round(recentAvg),
            trendDirection: direction,
          });
          success = true;
          break;
        } catch (error) {
          const isAbort = error instanceof Error && error.name === "AbortError";
          lastError = isAbort ? `Timeout nach ${FETCH_TIMEOUT_MS / 1000}s` : (error instanceof Error ? error.message : "Unbekannter Fehler");

          if (attempt < MAX_RETRIES) {
            const wait = Math.min(10_000 * 2 ** attempt, 60_000);
            console.warn(`[fetchGoogleTrends] ${isAbort ? "Timeout" : "Fehler"} bei "${keyword}", Retry in ${wait}ms (Versuch ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError}`);
            await new Promise((r) => setTimeout(r, wait));
          } else {
            console.error(`[fetchGoogleTrends] Endgueltig fehlgeschlagen fuer "${keyword}" nach ${MAX_RETRIES + 1} Versuchen: ${lastError}`);
          }
        }
      }

      if (!success) {
        results.push({ keyword: originalKeyword, trendAvg: null, trendRecent: null, trendDirection: null });
      }
    }
  }

  const pool = Math.min(concurrency, keywords.length || 1);
  await Promise.all(Array.from({ length: pool }, () => worker()));

  console.log(`[fetchGoogleTrends] Fertig: ${results.filter(r => r.trendAvg !== null).length}/${keywords.length} erfolgreich`);

  return results;
}

// ==========================================
// SEARCH INTENT API (DataForSEO Labs)
// ==========================================

export interface SearchIntentResult {
  keyword: string;
  intentLabel: string; // informational, navigational, commercial, transactional
  intentProbability: number;
  secondaryIntents: Array<{ label: string; probability: number }> | null;
}

/**
 * Ruft Search Intent Daten fuer Keywords ab via DataForSEO Labs.
 * Bis zu 1000 Keywords pro Request moeglich.
 * @see https://docs.dataforseo.com/v3/dataforseo_labs/google/search_intent/live/
 */
export async function fetchSearchIntent(
  keywords: string[],
  options?: { language_code?: string }
): Promise<SearchIntentResult[]> {
  const languageCode = options?.language_code ?? "de";

  console.log(`[fetchSearchIntent] ${keywords.length} Keywords, Language: ${languageCode}`);

  const results: SearchIntentResult[] = [];
  const batchSize = 1000;

  for (let i = 0; i < keywords.length; i += batchSize) {
    const rawBatch = keywords.slice(i, i + batchSize);
    const cleanedToOriginals = new Map<string, string[]>();
    const batch: string[] = [];

    for (const kw of rawBatch) {
      const cleaned = sanitizeKeyword(kw);
      if (!cleaned) continue;
      if (!cleanedToOriginals.has(cleaned)) {
        cleanedToOriginals.set(cleaned, []);
        batch.push(cleaned);
      }
      if (kw !== cleaned) {
        cleanedToOriginals.get(cleaned)!.push(kw);
      }
    }

    console.log(`[fetchSearchIntent] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(keywords.length / batchSize)} (${batch.length} Keywords)`);

    if (batch.length === 0) continue;

    try {
      const requestBody = [{
        keywords: batch,
        language_code: languageCode,
      }];

      const response = await fetch(
        `${DATAFORSEO_API_URL}/dataforseo_labs/google/search_intent/live`,
        {
          method: "POST",
          headers: {
            Authorization: getAuthHeader(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.status === 429) {
        console.warn(`[fetchSearchIntent] Rate limited, warte 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
        i -= batchSize; // Retry this batch
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fetchSearchIntent] HTTP ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      const task = data.tasks?.[0];

      if (task?.status_code !== 20000 || !task.result?.[0]?.items?.length) {
        console.warn(`[fetchSearchIntent] Keine Ergebnisse: ${task?.status_message}`);
        continue;
      }

      const items = task.result[0].items as Array<{
        keyword: string;
        keyword_intent: { label: string; probability: number } | null;
        secondary_keyword_intents: Array<{ label: string; probability: number }> | null;
      }>;

      for (const item of items) {
        const result = {
          keyword: item.keyword,
          intentLabel: item.keyword_intent?.label ?? "informational",
          intentProbability: item.keyword_intent?.probability ?? 0,
          secondaryIntents: item.secondary_keyword_intents ?? null,
        };
        results.push(result);
        const originals = cleanedToOriginals.get(item.keyword);
        if (originals) {
          for (const orig of originals) {
            results.push({ ...result, keyword: orig });
          }
        }
      }

      console.log(`[fetchSearchIntent] Batch erfolgreich: ${items.length} Ergebnisse`);

      if (i + batchSize < keywords.length) {
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (error) {
      console.error(`[fetchSearchIntent] Fehler bei Batch:`, error);
    }
  }

  console.log(`[fetchSearchIntent] Fertig: ${results.length}/${keywords.length} erfolgreich`);
  return results;
}

/**
 * Findet die Position einer URL in den Rankings
 * Sucht standardmäßig nach ubs.com URLs, wenn keine targetUrl angegeben ist
 */
export function findRankingPosition(
  results: RankTrackerResult[],
  keyword: string,
  targetUrl?: string
): { position: number | null; url: string | null } {
  console.log(`[findRankingPosition] Suche Rankings für Keyword: "${keyword}"`);
  console.log(`[findRankingPosition] Target URL: "${targetUrl || 'ubs.com (Standard)'}"`);
  console.log(`[findRankingPosition] Anzahl Results: ${results.length}`);
  
  const result = results.find((r) => r.keyword.toLowerCase() === keyword.toLowerCase());
  
  if (!result) {
    console.log(`[findRankingPosition] Kein Result gefunden für Keyword: "${keyword}"`);
    console.log(`[findRankingPosition] Verfügbare Keywords in Results:`, results.map(r => r.keyword));
    return { position: null, url: null };
  }
  
  if (!result.items || result.items.length === 0) {
    console.log(`[findRankingPosition] Keine Items im Result für Keyword: "${keyword}"`);
    return { position: null, url: null };
  }

  console.log(`[findRankingPosition] Gefundenes Result für Keyword: "${result.keyword}"`);
  console.log(`[findRankingPosition] Anzahl Items: ${result.items.length}`);
  console.log(`[findRankingPosition] Erste 10 Items:`, result.items.slice(0, 10).map((item, idx) => ({
    rank: item.rank_absolute,
    url: item.url,
    domain: item.domain,
    title: item.title?.substring(0, 50),
  })));

  // Standard: Suche nach ubs.com URLs
  const searchDomain = targetUrl || "ubs.com";

  // Extrahiere die Domain aus der targetUrl
  // z.B. "ubs.com", "www.ubs.com", "https://www.ubs.com/something" -> "ubs.com"
  let normalizedTarget = searchDomain.toLowerCase();
  
  // Entferne Protokoll
  normalizedTarget = normalizedTarget.replace(/^https?:\/\//, "");
  
  // Entferne www. Präfix
  normalizedTarget = normalizedTarget.replace(/^www\./, "");
  
  // Entferne Pfad und Query-Parameter (nur Domain behalten)
  normalizedTarget = normalizedTarget.split("/")[0].split("?")[0];
  
  // Entferne trailing slash
  normalizedTarget = normalizedTarget.replace(/\/$/, "");
  
  console.log(`[findRankingPosition] Normalisierte Target Domain: "${normalizedTarget}"`);
  
  // Suche nach URLs die die Domain enthalten
  const matchingItems: Array<{ item: typeof result.items[0]; normalizedUrl: string }> = [];
  
  // Logge alle Items für Debugging
  console.log(`[findRankingPosition] Prüfe ${result.items.length} Ranking-Items...`);
  
  result.items.forEach((item, index) => {
    // Prüfe ob item.url existiert
    if (!item.url) {
      console.log(`[findRankingPosition] Item ${index + 1}: Keine URL vorhanden`);
      return;
    }
    
    // Normalisiere die Item-URL für Vergleich
    let normalizedItemUrl = item.url.toLowerCase();
    
    // Entferne Protokoll
    normalizedItemUrl = normalizedItemUrl.replace(/^https?:\/\//, "");
    
    // Entferne www. Präfix für Vergleich
    normalizedItemUrl = normalizedItemUrl.replace(/^www\./, "");
    
    // Prüfe auch die Domain direkt
    const itemDomain = item.domain?.toLowerCase().replace(/^www\./, "") || "";
    
    // Prüfe ob die URL oder Domain die Target-Domain enthält
    // Wichtig: Prüfe auch ob die Domain mit der Target-Domain endet (z.B. "ubs.com" in "www.ubs.com")
    const urlMatches = normalizedItemUrl.includes(normalizedTarget);
    const domainMatches = itemDomain.includes(normalizedTarget) || itemDomain.endsWith(`.${normalizedTarget}`);
    const matches = urlMatches || domainMatches;
    
    if (index < 20) { // Logge nur die ersten 20 Items
      console.log(`[findRankingPosition] Item ${index + 1} (Rank ${item.rank_absolute}):`);
      console.log(`  Original URL: ${item.url}`);
      console.log(`  Domain: ${item.domain}`);
      console.log(`  Normalisiert URL: ${normalizedItemUrl}`);
      console.log(`  Normalisiert Domain: ${itemDomain}`);
      console.log(`  Target: "${normalizedTarget}"`);
      console.log(`  URL Match: ${urlMatches}, Domain Match: ${domainMatches}, Gesamt Match: ${matches}`);
    }
    
    if (matches) {
      matchingItems.push({ item, normalizedUrl: normalizedItemUrl });
      console.log(`[findRankingPosition] ✓ MATCH gefunden bei Position ${item.rank_absolute}: ${item.url}`);
    }
  });
  
  console.log(`[findRankingPosition] Gefundene Matches: ${matchingItems.length}`);
  
  if (matchingItems.length > 0) {
    // Nimm das erste Match (höchste Position = niedrigste rank_absolute Zahl)
    const bestMatch = matchingItems[0];
    console.log(`[findRankingPosition] ✓ Bestes Match gefunden:`);
    console.log(`  Position: ${bestMatch.item.rank_absolute}`);
    console.log(`  URL: ${bestMatch.item.url}`);
    console.log(`  Domain: ${bestMatch.item.domain}`);
    
    return {
      position: bestMatch.item.rank_absolute,
      url: bestMatch.item.url,
    };
  }

  console.log(`[findRankingPosition] ✗ Keine passende URL gefunden für Domain: "${normalizedTarget}"`);
  console.log(`[findRankingPosition] Alle gefundenen Domains (Top 20):`, [...new Set(result.items.slice(0, 20).map(i => i.domain))]);
  console.log(`[findRankingPosition] Alle gefundenen URLs (Top 20):`, result.items.slice(0, 20).map(i => i.url));
  
  // Wenn keine passende URL gefunden wurde, gib null zurück
  return { position: null, url: null };
}
