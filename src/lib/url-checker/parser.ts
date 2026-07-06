import { ParsedPage, SchemaData } from './types';

export function parseHtml(html: string, url: string, statusCode: number, redirectChain: string[], lastModifiedHeader: string | null): ParsedPage {
  const parsedUrl = new URL(url);

  return {
    url,
    statusCode,
    redirectChain,
    htmlSize: html.length,
    title: extractTitle(html),
    metaDescription: extractMetaDescription(html),
    canonical: extractCanonical(html),
    robotsMeta: extractRobotsMeta(html),
    viewport: extractViewport(html),
    isHttps: parsedUrl.protocol === 'https:',
    headings: extractHeadings(html),
    wordCount: countWords(html),
    textContent: extractTextContent(html),
    images: extractImages(html),
    internalLinks: extractLinks(html, parsedUrl, true),
    externalLinks: extractLinks(html, parsedUrl, false),
    schemas: extractSchemas(html),
    openGraph: extractOpenGraph(html),
    hreflang: extractHreflang(html),
    dates: {
      published: extractSchemaDate(html, 'datePublished'),
      modified: extractSchemaDate(html, 'dateModified'),
      lastModifiedHeader,
    },
    scripts: extractScripts(html),
    stylesheets: extractStylesheets(html),
    hiddenTextRatio: calculateHiddenTextRatio(html),
  };
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? decodeEntities(match[1].trim()) : '';
}

function extractMetaDescription(html: string): string {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  return match ? decodeEntities(match[1].trim()) : '';
}

function extractCanonical(html: string): string | null {
  const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i)
    || html.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*>/i);
  return match ? match[1].trim() : null;
}

function extractRobotsMeta(html: string): string | null {
  const match = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["'][^>]*>/i);
  return match ? match[1].trim().toLowerCase() : null;
}

function extractViewport(html: string): string | null {
  const match = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']viewport["'][^>]*>/i);
  return match ? match[1].trim() : null;
}

function extractHeadings(html: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  const cleanHtml = html.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  const regex = /<h([1-6])(?:\s+[^>]*|\s*)>([\s\S]*?)<\/h\1\s*>/gi;

  let match;
  while ((match = regex.exec(cleanHtml)) !== null) {
    let text = match[2].replace(/<\/[^>]+>/g, ' ').replace(/<[^>]+>/g, '');
    text = decodeEntities(text).replace(/\s+/g, ' ').trim();
    if (text && text.length <= 300) {
      headings.push({ level: parseInt(match[1]), text });
    }
  }
  return headings;
}

function countWords(html: string): number {
  const text = extractTextContent(html);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

function extractTextContent(html: string): string {
  let text = html;
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text);
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function extractImages(html: string): { src: string; alt: string | null }[] {
  const images: { src: string; alt: string | null }[] = [];
  const regex = /<img[^>]*>/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    const altMatch = tag.match(/alt=["']([^"']*)["']/i);
    if (srcMatch) {
      images.push({
        src: srcMatch[1],
        alt: altMatch ? altMatch[1] : null,
      });
    }
  }
  return images;
}

function extractLinks(html: string, baseUrl: URL, internal: boolean): { href: string; text: string; rel: string | null }[] {
  const links: { href: string; text: string; rel: string | null }[] = [];
  const regex = /<a\s[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    const hrefMatch = tag.match(/href=["']([^"'#]+)["']/i);
    if (!hrefMatch) continue;

    const href = hrefMatch[1].trim();
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;

    let isInternal = false;
    try {
      const linkUrl = new URL(href, baseUrl.origin);
      isInternal = linkUrl.hostname === baseUrl.hostname;
    } catch {
      isInternal = href.startsWith('/') || !href.startsWith('http');
    }

    if (isInternal !== internal) continue;

    const relMatch = tag.match(/rel=["']([^"']*)["']/i);
    let text = match[1].replace(/<[^>]+>/g, '').trim();
    text = decodeEntities(text).replace(/\s+/g, ' ').trim();

    links.push({
      href,
      text: text.slice(0, 200),
      rel: relMatch ? relMatch[1].toLowerCase() : null,
    });
  }
  return links;
}

function extractSchemas(html: string): SchemaData[] {
  const schemas: SchemaData[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item['@type']) {
            schemas.push({ type: item['@type'], properties: item });
          }
        }
      } else if (data['@graph']) {
        for (const item of data['@graph']) {
          if (item['@type']) {
            schemas.push({ type: item['@type'], properties: item });
          }
        }
      } else if (data['@type']) {
        schemas.push({ type: data['@type'], properties: data });
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  }
  return schemas;
}

function extractOpenGraph(html: string): Record<string, string> {
  const og: Record<string, string> = {};
  const regex = /<meta[^>]*property=["'](og:[^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
  const regex2 = /<meta[^>]*content=["']([^"']*)["'][^>]*property=["'](og:[^"']+)["'][^>]*>/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    og[match[1]] = decodeEntities(match[2]);
  }
  while ((match = regex2.exec(html)) !== null) {
    og[match[2]] = decodeEntities(match[1]);
  }
  return og;
}

function extractHreflang(html: string): { lang: string; href: string }[] {
  const hreflangs: { lang: string; href: string }[] = [];
  const regex = /<link[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']*)["'][^>]*href=["']([^"']*)["'][^>]*>/gi;
  const regex2 = /<link[^>]*hreflang=["']([^"']*)["'][^>]*href=["']([^"']*)["'][^>]*rel=["']alternate["'][^>]*>/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    hreflangs.push({ lang: match[1], href: match[2] });
  }
  while ((match = regex2.exec(html)) !== null) {
    hreflangs.push({ lang: match[1], href: match[2] });
  }
  return hreflangs;
}

function extractSchemaDate(html: string, property: string): string | null {
  // Check JSON-LD
  const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = ldRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const found = findPropertyInSchema(data, property);
      if (found) return found;
    } catch {
      // skip
    }
  }

  // Check meta tags (article:published_time, article:modified_time)
  const metaProperty = property === 'datePublished' ? 'article:published_time' : 'article:modified_time';
  const metaMatch = html.match(new RegExp(`<meta[^>]*property=["']${metaProperty}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i'))
    || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${metaProperty}["'][^>]*>`, 'i'));
  if (metaMatch) return metaMatch[1];

  // Check time tags
  const timeAttr = property === 'datePublished' ? 'pubdate|itemprop="datePublished"' : 'itemprop="dateModified"';
  const timeMatch = html.match(new RegExp(`<time[^>]*(?:${timeAttr})[^>]*datetime=["']([^"']*)["'][^>]*>`, 'i'));
  if (timeMatch) return timeMatch[1];

  return null;
}

function findPropertyInSchema(data: unknown, property: string): string | null {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findPropertyInSchema(item, property);
      if (found) return found;
    }
    return null;
  }
  const obj = data as Record<string, unknown>;
  if (obj[property] && typeof obj[property] === 'string') return obj[property] as string;
  if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    return findPropertyInSchema(obj['@graph'], property);
  }
  return null;
}

function extractScripts(html: string): { src: string | null; isAsync: boolean; isDefer: boolean }[] {
  const scripts: { src: string | null; isAsync: boolean; isDefer: boolean }[] = [];
  const regex = /<script[^>]*>/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    if (tag.includes('type="application/ld+json"') || tag.includes("type='application/ld+json'")) continue;
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    scripts.push({
      src: srcMatch ? srcMatch[1] : null,
      isAsync: /\basync\b/i.test(tag),
      isDefer: /\bdefer\b/i.test(tag),
    });
  }
  return scripts;
}

function extractStylesheets(html: string): string[] {
  const stylesheets: string[] = [];
  const regex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const regex2 = /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    stylesheets.push(match[1]);
  }
  while ((match = regex2.exec(html)) !== null) {
    if (!stylesheets.includes(match[1])) {
      stylesheets.push(match[1]);
    }
  }
  return stylesheets;
}

function calculateHiddenTextRatio(html: string): number {
  const hiddenPatterns = [
    /display\s*:\s*none/gi,
    /visibility\s*:\s*hidden/gi,
    /opacity\s*:\s*0[^.0-9]/gi,
    /font-size\s*:\s*0/gi,
    /text-indent\s*:\s*-\d{4,}/gi,
    /position\s*:\s*absolute[^"]*left\s*:\s*-\d{4,}/gi,
  ];

  let hiddenCount = 0;
  for (const pattern of hiddenPatterns) {
    const matches = html.match(pattern);
    if (matches) hiddenCount += matches.length;
  }

  const totalElements = (html.match(/<[a-z][^>]*>/gi) || []).length;
  if (totalElements === 0) return 0;
  return Math.min(hiddenCount / totalElements, 1);
}

function decodeEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&quot;': '"', '&apos;': "'", '&#39;': "'",
    '&ndash;': '\u2013', '&mdash;': '\u2014',
    '&lsquo;': '\u2018', '&rsquo;': '\u2019',
    '&ldquo;': '\u201C', '&rdquo;': '\u201D',
    '&hellip;': '\u2026', '&euro;': '\u20AC',
    '&copy;': '\u00A9', '&reg;': '\u00AE',
    '&auml;': '\u00E4', '&ouml;': '\u00F6', '&uuml;': '\u00FC',
    '&Auml;': '\u00C4', '&Ouml;': '\u00D6', '&Uuml;': '\u00DC',
    '&szlig;': '\u00DF',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replaceAll(entity, char);
  }
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  decoded = decoded.replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  return decoded;
}
