export interface ContentFilters {
  q: string;
  status: string;
  country: string;
  language: string;
  section: string;
  minWords: string;
  noindex: boolean;
}

export const EMPTY_FILTERS: ContentFilters = {
  q: "",
  status: "",
  country: "",
  language: "",
  section: "",
  minWords: "",
  noindex: false,
};

export interface ContentStats {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  open: number;
}

export interface ContentFacets {
  countries: string[];
  languages: string[];
  sections: string[];
}

export interface ContentRow {
  id: string;
  url: string;
  country: string | null;
  language: string | null;
  section: string | null;
  gscImpressions: number;
  content: {
    status: string;
    httpStatus: number | null;
    title: string | null;
    h1: string | null;
    robots: string | null;
    wordCount: number;
    sectionCount: number;
    fetchedVia: string | null;
    error: string | null;
    crawledAt: string | null;
  } | null;
}

export interface ContentListResponse {
  total: number;
  page: number;
  pageSize: number;
  rows: ContentRow[];
  stats: ContentStats;
  facets: ContentFacets | null;
}

export interface ContentSectionDto {
  id: string;
  position: number;
  level: number;
  heading: string | null;
  headingPath: string[];
  text: string;
  wordCount: number;
}

export interface ContentDetailDto {
  status: string;
  httpStatus: number | null;
  finalUrl: string | null;
  fetchedVia: string | null;
  error: string | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonical: string | null;
  robots: string | null;
  lang: string | null;
  headings: { level: number; text: string }[] | null;
  wordCount: number;
  sectionCount: number;
  crawledAt: string | null;
  sections: ContentSectionDto[];
}

export function scopeFromFilters(f: ContentFilters) {
  return { q: f.q.trim(), country: f.country, language: f.language, section: f.section };
}
