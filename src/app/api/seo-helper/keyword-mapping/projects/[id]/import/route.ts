import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseMappingWorkbook, type ParsedMappingRow } from "@/lib/keyword-map/excel";
import { parseDropdownOptions, requireUser } from "@/lib/keyword-map/server";
import { DROPDOWN_KEYS } from "@/lib/keyword-map/shared";

export const maxDuration = 120;

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const UPDATE_CHUNK = 20;

function urlData(row: ParsedMappingRow) {
  return {
    h1: row.h1,
    noindex: row.noindex,
    statusCode: row.statusCode,
    navigationType: row.navigationType,
    pageType: row.pageType,
    funnel: row.funnel,
    targetGroup: row.targetGroup,
    topicAuthority: row.topicAuthority,
    ctas: row.ctas as unknown as Prisma.InputJsonValue,
    furtherLinks: row.furtherLinks,
    subSearchVolume: row.subSearchVolume,
    dfsTopKeyword: row.dfsTopKeyword,
    dfsSearchVolume: row.dfsSearchVolume,
    dfsRank: row.dfsRank,
    manualRank: row.manualRank,
    gscClicks: row.gscClicks,
    comment: row.comment,
  };
}

/** Beim Zusammenführen überschreiben nur Felder, die im Excel tatsächlich befüllt sind. */
function mergeData(row: ParsedMappingRow): Prisma.KeywordMapUrlUpdateInput {
  const full = urlData(row);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(full)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (key === "noindex" && value === false) continue;
    out[key] = value;
  }
  return out as Prisma.KeywordMapUrlUpdateInput;
}

function keywordRows(urlId: string, row: ParsedMappingRow): Prisma.KeywordMapKeywordCreateManyInput[] {
  const out: Prisma.KeywordMapKeywordCreateManyInput[] = [];
  if (row.focusKeyword) {
    out.push({ urlId, keyword: row.focusKeyword, type: "focus", searchVolume: row.focusSearchVolume, source: "import", position: 0 });
  }
  row.subKeywords.forEach((keyword, i) => {
    out.push({ urlId, keyword, type: "sub", searchVolume: null, source: "import", position: i + 1 });
  });
  return out;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id: projectId } = await ctx.params;
    const project = await prisma.keywordMapProject.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Datei fehlt" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Datei ist zu gross (max. 15 MB)" }, { status: 400 });
    }
    const preview = form.get("preview") === "true";
    const sheet = (form.get("sheet") as string | null) || null;
    const mode = form.get("mode") === "replace" ? "replace" : "merge";

    const parsed = await parseMappingWorkbook(await file.arrayBuffer(), sheet);
    const existing = await prisma.keywordMapUrl.findMany({
      where: { projectId },
      select: { id: true, url: true },
    });
    const existingByUrl = new Map(existing.map((e) => [e.url, e.id]));

    if (preview) {
      return NextResponse.json({
        sheet: parsed.sheet,
        mappingSheets: parsed.mappingSheets,
        headerRow: parsed.headerRow,
        columns: parsed.columns.filter((c) => c.header || c.field).map((c) => ({ header: c.header, group: c.group, field: c.field })),
        rowCount: parsed.rows.length,
        withFocus: parsed.rows.filter((r) => r.focusKeyword).length,
        withSubs: parsed.rows.filter((r) => r.subKeywords.length > 0).length,
        newUrls: parsed.rows.filter((r) => !existingByUrl.has(r.url)).length,
        existingUrls: parsed.rows.filter((r) => existingByUrl.has(r.url)).length,
        projectUrlCount: existing.length,
        dropdownOptions: parsed.dropdownOptions,
        sample: parsed.rows.slice(0, 5),
        warnings: parsed.warnings,
      });
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: "Keine URLs im Sheet gefunden", warnings: parsed.warnings }, { status: 400 });
    }

    if (mode === "replace" && existing.length > 0) {
      await prisma.keywordMapUrl.deleteMany({ where: { projectId } });
      existingByUrl.clear();
    }

    const toCreate = parsed.rows.filter((r) => !existingByUrl.has(r.url));
    const toUpdate = parsed.rows.filter((r) => existingByUrl.has(r.url));

    if (toCreate.length > 0) {
      await prisma.keywordMapUrl.createMany({
        data: toCreate.map((r) => ({ projectId, url: r.url, ...urlData(r) })),
        skipDuplicates: true,
      });
      const created = await prisma.keywordMapUrl.findMany({
        where: { projectId, url: { in: toCreate.map((r) => r.url) } },
        select: { id: true, url: true },
      });
      const createdByUrl = new Map(created.map((c) => [c.url, c.id]));
      const keywords = toCreate.flatMap((r) => {
        const urlId = createdByUrl.get(r.url);
        return urlId ? keywordRows(urlId, r) : [];
      });
      if (keywords.length > 0) {
        await prisma.keywordMapKeyword.createMany({ data: keywords, skipDuplicates: true });
      }
    }

    for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK) {
      const chunk = toUpdate.slice(i, i + UPDATE_CHUNK);
      await Promise.all(
        chunk.map(async (row) => {
          const urlId = existingByUrl.get(row.url)!;
          await prisma.keywordMapUrl.update({ where: { id: urlId }, data: mergeData(row) });
          if (row.focusKeyword) {
            await prisma.keywordMapKeyword.deleteMany({
              where: { urlId, OR: [{ type: "focus" }, { keyword: row.focusKeyword }] },
            });
          }
          const kws = keywordRows(urlId, row);
          if (kws.length > 0) await prisma.keywordMapKeyword.createMany({ data: kws, skipDuplicates: true });
        })
      );
    }

    const merged = { ...parseDropdownOptions(project.dropdownOptions) };
    for (const key of DROPDOWN_KEYS) {
      const values = [...(merged[key] ?? [])];
      for (const value of parsed.dropdownOptions[key] ?? []) {
        if (!values.includes(value)) values.push(value);
      }
      if (values.length > 0) merged[key] = values;
    }
    await prisma.keywordMapProject.update({ where: { id: projectId }, data: { dropdownOptions: merged } });

    return NextResponse.json({
      created: toCreate.length,
      updated: toUpdate.length,
      sheet: parsed.sheet,
      warnings: parsed.warnings,
    });
  } catch (e) {
    console.error("[keyword-mapping/import]", e);
    const message = e instanceof Error ? e.message : "Import fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
