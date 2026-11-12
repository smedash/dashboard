import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addSubKeywords, loadUrlDto, requireUser, setFocusKeyword } from "@/lib/keyword-map/server";
import type { KeywordSource } from "@/lib/keyword-map/shared";

const SOURCES: KeywordSource[] = ["import", "manual", "dataforseo", "seospark"];
const toSource = (v: unknown): KeywordSource => (SOURCES.includes(v as KeywordSource) ? (v as KeywordSource) : "manual");
const toVolume = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

/** Fokus-Keyword setzen (`keyword: null` entfernt es). */
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as { keyword?: string | null; searchVolume?: number | null; source?: string };
    await setFocusKeyword(id, body.keyword ?? null, toVolume(body.searchVolume), toSource(body.source));
    await prisma.keywordMapUrl.update({ where: { id }, data: { updatedAt: new Date() } });
    return NextResponse.json({ url: await loadUrlDto(id) });
  } catch (e) {
    console.error("[keyword-mapping/keywords] PUT", e);
    return NextResponse.json({ error: "Fokus-Keyword konnte nicht gesetzt werden" }, { status: 500 });
  }
}

/** Subkeywords hinzufügen. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      keywords?: Array<{ keyword: string; searchVolume?: number | null }>;
      source?: string;
    };
    const items = (Array.isArray(body.keywords) ? body.keywords : [])
      .filter((k) => typeof k?.keyword === "string")
      .map((k) => ({ keyword: k.keyword, searchVolume: toVolume(k.searchVolume) }));
    const added = await addSubKeywords(id, items, toSource(body.source));
    await prisma.keywordMapUrl.update({ where: { id }, data: { updatedAt: new Date() } });
    return NextResponse.json({ added, url: await loadUrlDto(id) });
  } catch (e) {
    console.error("[keyword-mapping/keywords] POST", e);
    return NextResponse.json({ error: "Subkeywords konnten nicht hinzugefügt werden" }, { status: 500 });
  }
}

/** Subkeywords entfernen (`keywordIds`). */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as { keywordIds?: string[] };
    const keywordIds = Array.isArray(body.keywordIds) ? body.keywordIds : [];
    await prisma.keywordMapKeyword.deleteMany({ where: { urlId: id, id: { in: keywordIds }, type: "sub" } });
    return NextResponse.json({ url: await loadUrlDto(id) });
  } catch (e) {
    console.error("[keyword-mapping/keywords] DELETE", e);
    return NextResponse.json({ error: "Subkeywords konnten nicht entfernt werden" }, { status: 500 });
  }
}
