import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidKvpCategory } from "@/lib/kvp";
import { mapUrlInclude, parseDropdownOptions, requireUser, serializeUrls } from "@/lib/keyword-map/server";
import { DROPDOWN_KEYS, type DropdownOptions, cleanText } from "@/lib/keyword-map/shared";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const project = await prisma.keywordMapProject.findUnique({ where: { id } });
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });

    const rows = await prisma.keywordMapUrl.findMany({
      where: { projectId: id },
      include: mapUrlInclude,
      orderBy: { url: "asc" },
    });

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        category: project.category,
        countryCode: project.countryCode,
        languageCode: project.languageCode,
        dropdownOptions: parseDropdownOptions(project.dropdownOptions),
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      urls: serializeUrls(rows),
    });
  } catch (e) {
    console.error("[keyword-mapping/projects/[id]] GET", e);
    return NextResponse.json({ error: "Projekt konnte nicht geladen werden" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      name?: string;
      category?: string | null;
      countryCode?: string;
      languageCode?: string;
      dropdownOptions?: DropdownOptions;
    };
    const data: Prisma.KeywordMapProjectUpdateInput = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (body.category !== undefined) {
      if (body.category && !isValidKvpCategory(body.category)) {
        return NextResponse.json({ error: "Ungültige Kategorie" }, { status: 400 });
      }
      data.category = body.category || null;
    }
    if (typeof body.countryCode === "string" && body.countryCode.trim()) data.countryCode = body.countryCode.trim().toLowerCase();
    if (typeof body.languageCode === "string" && body.languageCode.trim()) data.languageCode = body.languageCode.trim().toLowerCase();
    if (body.dropdownOptions && typeof body.dropdownOptions === "object") {
      const cleaned: DropdownOptions = {};
      for (const key of DROPDOWN_KEYS) {
        const values = body.dropdownOptions[key];
        if (Array.isArray(values)) {
          cleaned[key] = [...new Set(values.filter((v) => typeof v === "string").map(cleanText).filter(Boolean))];
        }
      }
      data.dropdownOptions = cleaned;
    }

    await prisma.keywordMapProject.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[keyword-mapping/projects/[id]] PATCH", e);
    return NextResponse.json({ error: "Projekt konnte nicht gespeichert werden" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const { id } = await ctx.params;
    await prisma.keywordMapProject.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[keyword-mapping/projects/[id]] DELETE", e);
    return NextResponse.json({ error: "Projekt konnte nicht gelöscht werden" }, { status: 500 });
  }
}
