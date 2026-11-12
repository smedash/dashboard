import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadUrlDto, requireUser } from "@/lib/keyword-map/server";
import { EDITABLE_URL_FIELDS, cleanText, dedupeDfsKeywords, type DfsKeywordRow, type MapCta } from "@/lib/keyword-map/shared";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser();
  if (error) return error;

  const { id } = await ctx.params;
  const row = await prisma.keywordMapUrl.findUnique({ where: { id }, select: { dfsKeywords: true } });
  const dto = await loadUrlDto(id);
  if (!dto || !row) return NextResponse.json({ error: "URL nicht gefunden" }, { status: 404 });
  const dfsKeywords = Array.isArray(row.dfsKeywords) ? dedupeDfsKeywords(row.dfsKeywords as unknown as DfsKeywordRow[]) : [];
  return NextResponse.json({ url: dto, dfsKeywords });
}

function textOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = cleanText(v);
  return t ? t : null;
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/['’\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as Record<string, unknown>;
    const data: Prisma.KeywordMapUrlUpdateInput = {};

    for (const field of EDITABLE_URL_FIELDS) {
      if (!(field in body)) continue;
      const value = body[field];
      switch (field) {
        case "url": {
          const url = textOrNull(value);
          if (!url) return NextResponse.json({ error: "URL darf nicht leer sein" }, { status: 400 });
          data.url = url;
          break;
        }
        case "noindex":
          data.noindex = value === true;
          break;
        case "statusCode":
        case "gscClicks":
        case "subSearchVolume":
          data[field] = intOrNull(value);
          break;
        case "ctas": {
          const ctas: MapCta[] = Array.isArray(value)
            ? value
                .map((c) => ({ label: textOrNull(c?.label) ?? "", link: textOrNull(c?.link) ?? "" }))
                .filter((c) => c.label || c.link)
            : [];
          data.ctas = ctas as unknown as Prisma.InputJsonValue;
          break;
        }
        case "furtherLinks":
          data.furtherLinks = Array.isArray(value)
            ? value.map((l) => textOrNull(l)).filter((l): l is string => !!l)
            : [];
          break;
        default:
          data[field] = textOrNull(value);
      }
    }

    await prisma.keywordMapUrl.update({ where: { id }, data });
    return NextResponse.json({ url: await loadUrlDto(id) });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Diese URL existiert im Projekt bereits" }, { status: 409 });
    }
    console.error("[keyword-mapping/urls/[id]] PATCH", e);
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    await prisma.keywordMapUrl.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[keyword-mapping/urls/[id]] DELETE", e);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
