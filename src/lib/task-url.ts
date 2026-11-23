export class InvalidTaskUrlError extends Error {
  constructor() {
    super("Ungültige URL (nur http/https)");
  }
}

/**
 * Leere Werte werden zu `null`, fehlendes Protokoll wird zu `https://` ergänzt.
 * Wirft bei anderen Protokollen als http/https, damit kein `javascript:`-Link im Board landet.
 */
export function normalizeTaskUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new InvalidTaskUrlError();
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new InvalidTaskUrlError();
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new InvalidTaskUrlError();
  return parsed.toString();
}
