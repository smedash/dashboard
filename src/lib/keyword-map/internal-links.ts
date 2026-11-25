import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadHtml } from "@/lib/content-mapping/fetch";
import { selectMainHtml } from "@/lib/content-mapping/extract";
import { decodeEntities } from "@/lib/url-checker/parser";
import { toUrlKey } from "@/lib/url-cleanup/normalize";
import type { TopicGapItem, TopicLink } from "./shared";

const LINK_RE = /<a\b([^>]*?)\shref\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a\s*>/gi;
const MAX_ANCHOR_CHARS = 200;

function hostKey(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/** Schlüssel für den Abgleich: normalisierter Pfad ohne `.html`, Query und Fragment. */
export function linkKey(url: string): string | null {
  return toUrlKey(url)?.urlKeyNoHtml ?? null;
}

function anchorText(attrs: string, inner: string): string {
  const text = decodeEntities(inner.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, MAX_ANCHOR_CHARS);
  const fallback = (inner + attrs).match(/\b(?:aria-label|alt|title)\s*=\s*(["'])(.*?)\1/i)?.[2];
  return fallback ? decodeEntities(fallback).replace(/\s+/g, " ").trim().slice(0, MAX_ANCHOR_CHARS) : "";
}

function collectLinks(fragment: string, base: URL): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of fragment.matchAll(LINK_RE)) {
    const href = decodeEntities(m[3]).trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(href)) continue;
    let target: URL;
    try {
      target = new URL(href, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(target.protocol) || hostKey(target.hostname) !== hostKey(base.hostname)) continue;
    const key = linkKey(target.href);
    if (!key) continue;
    const anchor = anchorText(m[1] + m[4], m[5]);
    if (!out.has(key) || (!out.get(key) && anchor)) out.set(key, anchor);
  }
  return out;
}

/** Interne Links einer Seite je Ziel-Pfad; ein Link im Hauptinhalt hat Vorrang vor Navigation und Footer. */
export function extractInternalLinks(html: string, pageUrl: string): Map<string, TopicLink> {
  const base = new URL(pageUrl);
  const result = new Map<string, TopicLink>();
  for (const [key, anchor] of collectLinks(selectMainHtml(html), base)) result.set(key, { anchor, inContent: true });
  for (const [key, anchor] of collectLinks(html, base)) {
    if (!result.has(key)) result.set(key, { anchor, inContent: false });
  }
  return result;
}

/** Abgleichsschlüssel je Inventar-URL: URL, finaler URL nach Redirects und Canonical aus dem Content-Mapping. */
async function targetKeys(inventoryIds: string[]): Promise<Map<string, Set<string>>> {
  const rows = await prisma.urlInventory.findMany({
    where: { id: { in: inventoryIds } },
    select: { id: true, url: true, content: { select: { finalUrl: true, canonical: true } } },
  });
  const out = new Map<string, Set<string>>();
  for (const row of rows) {
    const keys = new Set<string>();
    for (const url of [row.url, row.content?.finalUrl, row.content?.canonical]) {
      const key = url ? linkKey(url) : null;
      if (key) keys.add(key);
    }
    out.set(row.id, keys);
  }
  return out;
}

function findLink(links: Map<string, TopicLink>, keys: Iterable<string>): TopicLink | null {
  let best: TopicLink | null = null;
  for (const key of keys) {
    const link = links.get(key);
    if (link && (!best || (link.inContent && !best.inContent))) best = link;
  }
  return best;
}

/**
 * Lädt die Mapping-URL einer erfolgreichen Gap-Analyse und vermerkt an jeder `otherUrl`, ob die Seite
 * bereits intern dorthin verlinkt. Speichert `linksCheckedAt` bzw. `linkCheckError`.
 */
export async function runLinkCheck(gapId: string): Promise<void> {
  const gap = await prisma.keywordMapTopicGap.findUnique({ where: { id: gapId }, include: { url: { select: { url: true } } } });
  if (!gap || gap.status !== "succeeded" || !Array.isArray(gap.results)) return;

  try {
    const items = gap.results as unknown as TopicGapItem[];
    const hasTargets = items.some((i) => (i.otherUrls?.length ?? 0) > 0);
    let links = new Map<string, TopicLink>();
    if (hasTargets) {
      const page = await loadHtml(gap.url.url, { logPrefix: "keyword-map/internal-links" });
      links = extractInternalLinks(page.html, page.finalUrl || gap.url.url);
    }

    await prisma.$transaction(async (tx) => {
      const fresh = await tx.$queryRaw<Array<{ results: unknown }>>`
        SELECT "results" FROM "KeywordMapTopicGap" WHERE "id" = ${gapId} FOR UPDATE
      `;
      const current = Array.isArray(fresh[0]?.results) ? (fresh[0].results as TopicGapItem[]) : [];
      const ids = [...new Set(current.flatMap((i) => i.otherUrls?.map((u) => u.inventoryId) ?? []))];
      const keysById = ids.length ? await targetKeys(ids) : new Map<string, Set<string>>();
      const merged = current.map((i) =>
        i.otherUrls
          ? {
              ...i,
              otherUrls: i.otherUrls.map((u) => {
                const keys = new Set(keysById.get(u.inventoryId) ?? []);
                const own = linkKey(u.url);
                if (own) keys.add(own);
                return { ...u, link: findLink(links, keys) };
              }),
            }
          : i
      );
      await tx.keywordMapTopicGap.update({
        where: { id: gapId },
        data: { results: merged as unknown as Prisma.InputJsonValue, linksCheckedAt: new Date(), linkCheckError: null },
      });
    });
  } catch (e) {
    console.error("[keyword-map/internal-links] Linkprüfung fehlgeschlagen", e);
    await prisma.keywordMapTopicGap.update({
      where: { id: gapId },
      data: { linkCheckError: e instanceof Error ? e.message : "Linkprüfung fehlgeschlagen" },
    });
  }
}
