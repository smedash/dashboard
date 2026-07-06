export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  factor: string;
  status: CheckStatus;
  value: string | number | null;
  recommendation: string;
  leakAttribute: string;
}

export interface CategoryResult {
  name: string;
  score: number;
  leakReference: string;
  checks: CheckResult[];
}

export interface UrlCheckResult {
  url: string;
  overallScore: number;
  categories: CategoryResult[];
  keyword?: string;
  fetchedAt: string;
}

export interface ParsedPage {
  url: string;
  statusCode: number;
  redirectChain: string[];
  htmlSize: number;
  title: string;
  metaDescription: string;
  canonical: string | null;
  robotsMeta: string | null;
  viewport: string | null;
  isHttps: boolean;
  headings: { level: number; text: string }[];
  wordCount: number;
  textContent: string;
  images: { src: string; alt: string | null }[];
  internalLinks: { href: string; text: string; rel: string | null }[];
  externalLinks: { href: string; text: string; rel: string | null }[];
  schemas: SchemaData[];
  openGraph: Record<string, string>;
  hreflang: { lang: string; href: string }[];
  dates: {
    published: string | null;
    modified: string | null;
    lastModifiedHeader: string | null;
  };
  scripts: { src: string | null; isAsync: boolean; isDefer: boolean }[];
  stylesheets: string[];
  hiddenTextRatio: number;
  keyword?: string;
}

export interface SchemaData {
  type: string;
  properties: Record<string, unknown>;
}

export interface CategoryWeight {
  name: string;
  weight: number;
}
