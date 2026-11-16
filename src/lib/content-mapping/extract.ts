import { createHash } from "crypto";
import { decodeEntities, parseHtml } from "@/lib/url-checker/parser";

const MAX_TEXT_CHARS = 100_000;
const MAX_SECTIONS = 300;

export interface ContentSection {
  position: number;
  level: number;
  heading: string | null;
  headingPath: string[];
  text: string;
  wordCount: number;
}

export interface ExtractedContent {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonical: string | null;
  robots: string | null;
  lang: string | null;
  headings: { level: number; text: string }[];
  sections: ContentSection[];
  text: string;
  wordCount: number;
  contentHash: string;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function stripBoilerplate(html: string, removeHeader: boolean): string {
  let out = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav\s*>/gi, "")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer\s*>/gi, "");
  if (removeHeader) out = out.replace(/<header\b[^>]*>[\s\S]*?<\/header\s*>/gi, "");
  return out;
}

/** Hauptinhalt: `<main>` bzw. `<article>`, sonst `<body>` ohne Seitenkopf. */
function selectMainHtml(html: string): string {
  for (const tag of ["main", "article"]) {
    const start = html.search(new RegExp(`<${tag}\\b`, "i"));
    const end = html.toLowerCase().lastIndexOf(`</${tag}`);
    if (start !== -1 && end > start) return stripBoilerplate(html.slice(start, end), false);
  }
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  return stripBoilerplate(body ? body[1] : html, true);
}

function htmlToText(fragment: string): string {
  const text = decodeEntities(
    fragment
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<\/(p|div|li|tr|section|article|aside|h[1-6]|ul|ol|table|blockquote|dd|dt|figcaption)>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " | ")
      .replace(/<[^>]+>/g, " ")
  );
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && line !== "•" && line !== "|")
    .join("\n");
}

function headingText(inner: string): string {
  return decodeEntities(inner.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Teilt den Hauptinhalt an H2–H4 in Abschnitte; Text vor der ersten Überschrift ist das Intro (level 0). */
export function extractSections(html: string): ContentSection[] {
  const main = selectMainHtml(html).replace(/<h1\b[^>]*>[\s\S]*?<\/h1\s*>/gi, "\n");
  const regex = /<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
  const raw: Array<{ level: number; heading: string | null; body: string }> = [];
  let cursor = 0;
  let current: { level: number; heading: string | null } = { level: 0, heading: null };
  let match: RegExpExecArray | null;
  while ((match = regex.exec(main)) !== null) {
    raw.push({ ...current, body: main.slice(cursor, match.index) });
    current = { level: Number(match[1]), heading: headingText(match[2]) || null };
    cursor = match.index + match[0].length;
  }
  raw.push({ ...current, body: main.slice(cursor) });

  const sections: ContentSection[] = [];
  const stack: Array<{ level: number; heading: string }> = [];
  for (const part of raw) {
    if (part.level > 0 && part.heading) {
      while (stack.length && stack[stack.length - 1].level >= part.level) stack.pop();
      stack.push({ level: part.level, heading: part.heading });
    }
    const text = htmlToText(part.body);
    if (!text) continue;
    sections.push({
      position: sections.length,
      level: part.level,
      heading: part.heading,
      headingPath: part.level > 0 ? stack.map((s) => s.heading) : [],
      text,
      wordCount: countWords(text),
    });
    if (sections.length >= MAX_SECTIONS) break;
  }
  return sections;
}

export function extractContent(html: string, url: string, status: number): ExtractedContent {
  const page = parseHtml(html, url, status, [], null);
  const sections = extractSections(html);
  const text = sections
    .map((s) => (s.heading ? `${s.heading}\n${s.text}` : s.text))
    .join("\n\n")
    .slice(0, MAX_TEXT_CHARS);
  const lang = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1] ?? null;
  return {
    title: page.title || null,
    metaDescription: page.metaDescription || null,
    h1: page.headings.find((h) => h.level === 1)?.text ?? null,
    canonical: page.canonical,
    robots: page.robotsMeta,
    lang,
    headings: page.headings,
    sections,
    text,
    wordCount: countWords(text),
    contentHash: createHash("sha256").update(text).digest("hex").slice(0, 32),
  };
}
