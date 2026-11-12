import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildMappingWorkbook } from "@/lib/keyword-map/excel";
import { mapUrlInclude, parseDropdownOptions, requireUser, serializeUrls } from "@/lib/keyword-map/server";
import type { TopicGapItem } from "@/lib/keyword-map/shared";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const project = await prisma.keywordMapProject.findUnique({ where: { id } });
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });

    const idsParam = request.nextUrl.searchParams.get("ids");
    const onlyIds = idsParam ? new Set(idsParam.split(",").filter(Boolean)) : null;

    const rows = await prisma.keywordMapUrl.findMany({
      where: { projectId: id },
      include: mapUrlInclude,
      orderBy: { url: "asc" },
    });
    const urls = serializeUrls(rows).filter((u) => !onlyIds || onlyIds.has(u.id));

    const gaps = new Map<string, { coverageScore: number | null; missingTopics: string[] }>();
    for (const row of rows) {
      const gap = row.topicGaps[0];
      if (!gap || gap.status !== "succeeded") continue;
      const results = Array.isArray(gap.results) ? (gap.results as unknown as TopicGapItem[]) : [];
      gaps.set(row.id, {
        coverageScore: gap.coverageScore,
        missingTopics: results.filter((r) => r.status === "missing").map((r) => r.topic),
      });
    }

    const buffer = await buildMappingWorkbook({
      projectName: project.name,
      urls,
      dropdownOptions: parseDropdownOptions(project.dropdownOptions),
      gaps,
    });

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = `${project.name.replace(/[^\w\- ]+/g, "").trim() || "Keyword-Mapping"}_KW Mapping_${date}.xlsx`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (e) {
    console.error("[keyword-mapping/export]", e);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
