import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidKvpCategory } from "@/lib/kvp";
import { parseDropdownOptions, requireUser } from "@/lib/keyword-map/server";
import type { MapProjectDto } from "@/lib/keyword-map/shared";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const projects = await prisma.keywordMapProject.findMany({ orderBy: { updatedAt: "desc" } });
    const ids = projects.map((p) => p.id);
    const [urlCounts, kvpCounts, focusRows] = await Promise.all([
      prisma.keywordMapUrl.groupBy({ by: ["projectId"], where: { projectId: { in: ids } }, _count: { _all: true } }),
      prisma.keywordMapUrl.groupBy({
        by: ["projectId"],
        where: { projectId: { in: ids }, kvpUrlId: { not: null } },
        _count: { _all: true },
      }),
      prisma.keywordMapUrl.findMany({
        where: { projectId: { in: ids }, keywords: { some: { type: "focus" } } },
        select: { projectId: true },
      }),
    ]);
    const focusCounts = new Map<string, number>();
    for (const r of focusRows) focusCounts.set(r.projectId, (focusCounts.get(r.projectId) ?? 0) + 1);

    const result: MapProjectDto[] = projects.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      countryCode: p.countryCode,
      languageCode: p.languageCode,
      dropdownOptions: parseDropdownOptions(p.dropdownOptions),
      urlCount: urlCounts.find((c) => c.projectId === p.id)?._count._all ?? 0,
      focusCount: focusCounts.get(p.id) ?? 0,
      kvpCount: kvpCounts.find((c) => c.projectId === p.id)?._count._all ?? 0,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
    return NextResponse.json({ projects: result });
  } catch (e) {
    console.error("[keyword-mapping/projects] GET", e);
    return NextResponse.json({ error: "Projekte konnten nicht geladen werden" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const body = (await request.json()) as {
      name?: string;
      category?: string | null;
      countryCode?: string;
      languageCode?: string;
    };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
    }
    if (body.category && !isValidKvpCategory(body.category)) {
      return NextResponse.json({ error: "Ungültige Kategorie" }, { status: 400 });
    }

    const project = await prisma.keywordMapProject.create({
      data: {
        name,
        category: body.category || null,
        countryCode: body.countryCode?.trim().toLowerCase() || "ch",
        languageCode: body.languageCode?.trim().toLowerCase() || "de",
        createdById: user.id,
      },
    });
    return NextResponse.json({ project: { id: project.id } });
  } catch (e) {
    console.error("[keyword-mapping/projects] POST", e);
    return NextResponse.json({ error: "Projekt konnte nicht angelegt werden" }, { status: 500 });
  }
}
