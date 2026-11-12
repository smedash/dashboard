import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidKvpCategory, syncKvpRankTrackerKeywords } from "@/lib/kvp";
import { getProjectMaxTotalSv, mapUrlInclude, requireUser, serializeUrls } from "@/lib/keyword-map/server";
import type { TopicGapItem } from "@/lib/keyword-map/shared";

export const maxDuration = 120;

const MAX_BATCH = 100;

type PushResult = { status: "created" | "updated" | "skipped"; kvpUrlId?: string; reason?: string };

function gapComment(focusKeyword: string, coverage: number | null, summary: string | null, items: TopicGapItem[]): string {
  const missing = items.filter((i) => i.status === "missing").map((i) => i.topic);
  const partial = items.filter((i) => i.status === "partial").map((i) => i.topic);
  const lines = [
    `Topic-Gap-Analyse (Keyword Mapping) für „${focusKeyword}“: Coverage ${coverage ?? "–"} %`,
  ];
  if (summary) lines.push("", summary);
  if (missing.length) lines.push("", `Fehlende Topics (${missing.length}):`, ...missing.map((t) => `- ${t}`));
  if (partial.length) lines.push("", `Nur teilweise abgedeckt (${partial.length}):`, ...partial.map((t) => `- ${t}`));
  return lines.join("\n");
}

/** Body: `{ ids, includeGapComment? }` – legt KVP-Einträge an bzw. ergänzt bestehende (Abgleich über die URL). */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const body = (await request.json()) as { ids?: string[]; includeGapComment?: boolean };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string") : [];
    if (ids.length === 0) return NextResponse.json({ results: {}, urls: [] });
    if (ids.length > MAX_BATCH) {
      return NextResponse.json({ error: `Maximal ${MAX_BATCH} URLs pro Anfrage` }, { status: 400 });
    }

    const rows = await prisma.keywordMapUrl.findMany({
      where: { id: { in: ids } },
      include: { ...mapUrlInclude, project: true },
    });
    const results: Record<string, PushResult> = {};

    for (const row of rows) {
      const focus = row.keywords.find((k) => k.type === "focus")?.keyword;
      if (!focus) {
        results[row.id] = { status: "skipped", reason: "Kein Fokus-Keyword" };
        continue;
      }
      const subs = row.keywords.filter((k) => k.type === "sub").map((k) => k.keyword);
      const category = isValidKvpCategory(row.project.category) ? row.project.category : null;

      const existing =
        (row.kvpUrlId ? await prisma.kVPUrl.findUnique({ where: { id: row.kvpUrlId }, include: { subkeywords: true } }) : null) ??
        (await prisma.kVPUrl.findFirst({ where: { url: row.url }, include: { subkeywords: true }, orderBy: { createdAt: "asc" } }));

      let kvpUrlId: string;
      let status: PushResult["status"];
      if (existing) {
        const known = new Set(existing.subkeywords.map((s) => s.keyword.trim().toLowerCase()));
        known.add(focus);
        await prisma.kVPUrl.update({
          where: { id: existing.id },
          data: {
            focusKeyword: focus,
            ...(category && !existing.category ? { category } : {}),
            subkeywords: { create: subs.filter((s) => !known.has(s)).map((keyword) => ({ keyword })) },
          },
        });
        kvpUrlId = existing.id;
        status = "updated";
      } else {
        const created = await prisma.kVPUrl.create({
          data: {
            userId: user.id,
            url: row.url,
            focusKeyword: focus,
            category,
            subkeywords: { create: subs.map((keyword) => ({ keyword })) },
          },
        });
        kvpUrlId = created.id;
        status = "created";
      }

      const gap = row.topicGaps[0];
      if (body.includeGapComment && gap?.status === "succeeded") {
        const items = Array.isArray(gap.results) ? (gap.results as unknown as TopicGapItem[]) : [];
        await prisma.kVPComment.create({
          data: { urlId: kvpUrlId, text: gapComment(gap.focusKeyword, gap.coverageScore, gap.summary, items) },
        });
      }

      await syncKvpRankTrackerKeywords({ userId: user.id, url: row.url, keywords: [focus, ...subs], category });
      await prisma.keywordMapUrl.update({ where: { id: row.id }, data: { kvpUrlId } });
      results[row.id] = { status, kvpUrlId };
    }

    const fresh = await prisma.keywordMapUrl.findMany({ where: { id: { in: ids } }, include: mapUrlInclude });
    const max = fresh[0] ? await getProjectMaxTotalSv(fresh[0].projectId) : 0;
    return NextResponse.json({ results, urls: serializeUrls(fresh, max) });
  } catch (e) {
    console.error("[keyword-mapping/kvp-push]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "KVP-Push fehlgeschlagen" }, { status: 500 });
  }
}
