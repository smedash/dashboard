const TOPICLOOPS_API_URL = "https://api.topicloops.com/v1";

function getApiKey(): string {
  const key = process.env.TOPICLOOPS_API_KEY;
  if (!key) {
    throw new Error("TOPICLOOPS_API_KEY muss in der .env Datei gesetzt sein");
  }
  return key;
}

export interface TopicGraphNode {
  label: string;
  children: TopicGraphNode[];
}

export interface TopicGraphJob {
  id: string;
  created_at: string;
  parameters: {
    country_code: string;
    language_code: string;
    keyword: string;
  };
  status: "processing" | "failed" | "succeeded";
  topic_graph: TopicGraphNode | null;
}

export class TopicLoopsError extends Error {
  readonly status: number;
  /** Wartezeit aus dem Retry-After-Header in Millisekunden, falls vorhanden. */
  readonly retryAfterMs: number | null;

  constructor(status: number, retryAfter?: string | null) {
    super(`TopicLoops API Fehler: ${status}`);
    this.name = "TopicLoopsError";
    this.status = status;
    const seconds = retryAfter ? Number(retryAfter) : NaN;
    this.retryAfterMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
  }

  get rateLimited() {
    return this.status === 429;
  }
}

export interface TopicLoopsAccount {
  credits: number;
}

export async function getAccount(): Promise<TopicLoopsAccount> {
  const response = await fetch(`${TOPICLOOPS_API_URL}/account`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });

  if (!response.ok) {
    throw new TopicLoopsError(response.status, response.headers.get("retry-after"));
  }

  const json = await response.json();
  if (json.status !== "success") {
    throw new Error(`TopicLoops Fehler: ${json.error_code} - ${json.message}`);
  }

  return json.data;
}

export async function createTopicGraph(
  keyword: string,
  options?: { country_code?: string; language_code?: string }
): Promise<{ id: string; status: string }> {
  const countryCode = options?.country_code ?? "ch";
  const languageCode = options?.language_code ?? "de";

  console.log(`[TopicLoops] Erstelle Topic-Graph fuer "${keyword}" (${countryCode}/${languageCode})`);

  const response = await fetch(`${TOPICLOOPS_API_URL}/topic-graphs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      keyword: keyword.toLowerCase().trim(),
      country_code: countryCode,
      language_code: languageCode,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[TopicLoops] Fehler beim Erstellen: ${response.status} - ${errorText}`);
    throw new TopicLoopsError(response.status, response.headers.get("retry-after"));
  }

  const json = await response.json();
  if (json.status !== "success") {
    throw new Error(`TopicLoops Fehler: ${json.error_code} - ${json.message}`);
  }

  console.log(`[TopicLoops] Job erstellt: ${json.data.id}`);
  return json.data;
}

export async function getTopicGraph(id: string): Promise<TopicGraphJob> {
  const response = await fetch(`${TOPICLOOPS_API_URL}/topic-graphs/${id}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });

  if (!response.ok) {
    throw new TopicLoopsError(response.status, response.headers.get("retry-after"));
  }

  const json = await response.json();
  if (json.status !== "success") {
    throw new Error(`TopicLoops Fehler: ${json.error_code} - ${json.message}`);
  }

  return json.data;
}
