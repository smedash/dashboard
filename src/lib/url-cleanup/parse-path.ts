import { languageFromUrlPath } from "@/lib/url-language";

export type ParsedUbsPath = {
  country: string | null;
  language: string | null;
  section: string | null;
  pathDepth: number;
};

export function parseUbsPath(urlKey: string): ParsedUbsPath {
  const segments = urlKey.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase() ?? null;
  let country = first;
  let section: string | null = null;

  if (first === "microsites") {
    section = segments[1]?.toLowerCase() ?? null;
  } else {
    section = segments[2]?.toLowerCase() ?? null;
  }

  const language = languageFromUrlPath(urlKey);

  return {
    country,
    language,
    section,
    pathDepth: segments.length,
  };
}
