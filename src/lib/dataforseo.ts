// DataForSEO API Integration für Rank Tracking

const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

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

  for (let i = 0; i < keywords.length; i += batchSize) {
    const batch = keywords.slice(i, i + batchSize);
    console.log(`[fetchSearchVolume] Verarbeite Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(keywords.length / batchSize)}`);

    try {
      // Explizit Schweiz setzen mit location_code UND location_name
      const requestBody = [{
        keywords: batch,
        location_code: 2756, // Schweiz - HARDCODED
        location_name: "Switzerland",
        language_code: "de",
        language_name: "German",
      }];

      console.log(`[fetchSearchVolume] Request Body:`, JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${DATAFORSEO_API_URL}/keywords_data/google_ads/search_volume/live`, {
        method: "POST",
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fetchSearchVolume] API Fehler: ${response.status} - ${errorText}`);
        continue; // Weiter mit nächstem Batch
      }

      const data = await response.json();

      if (data.tasks && data.tasks.length > 0) {
        const task = data.tasks[0];
        console.log(`[fetchSearchVolume] Response Status: ${task.status_code} (${task.status_message})`);

        if (task.status_code === 20000 && task.result && task.result.length > 0) {
          const results = task.result as (SearchVolumeResult & { location_code?: number })[];
          console.log(`[fetchSearchVolume] ✓ ${results.length} Suchvolumen-Ergebnisse erhalten`);
          
          // Logge die ersten 5 Ergebnisse mit Location Code zur Überprüfung
          results.slice(0, 5).forEach((r) => {
            console.log(`[fetchSearchVolume]   "${r.keyword}": ${r.search_volume || 0} monatliche Suchen (Location: ${r.location_code || 'N/A'})`);
          });

          allResults.push(...results);
        } else {
          console.warn(`[fetchSearchVolume] ✗ Keine Ergebnisse: ${task.status_message}`);
        }
      }

      // Kurze Pause zwischen Batches um Rate-Limits zu vermeiden
      if (i + batchSize < keywords.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`[fetchSearchVolume] Fehler bei Batch:`, error);
      // Weiter mit nächstem Batch
    }
  }

  console.log(`[fetchSearchVolume] ====== Fertig ======`);
  console.log(`[fetchSearchVolume] Gesamt: ${allResults.length} Ergebnisse für ${keywords.length} Keywords`);

  return allResults;
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
