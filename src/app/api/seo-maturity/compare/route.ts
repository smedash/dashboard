import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperadmin } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

// GET /api/seo-maturity/compare?base=ID1&target=ID2
// Vergleicht zwei Analysen miteinander
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const baseId = searchParams.get("base");
    const targetId = searchParams.get("target");

    if (!baseId || !targetId) {
      return NextResponse.json(
        { error: "Both 'base' and 'target' parameters are required" },
        { status: 400 }
      );
    }

    const [baseMaturity, targetMaturity] = await Promise.all([
      prisma.sEOMaturity.findUnique({
        where: { id: baseId },
        include: {
          items: {
            include: { teams: { include: { team: true } } },
            orderBy: [{ category: "asc" }, { order: "asc" }],
          },
        },
      }),
      prisma.sEOMaturity.findUnique({
        where: { id: targetId },
        include: {
          items: {
            include: { teams: { include: { team: true } } },
            orderBy: [{ category: "asc" }, { order: "asc" }],
          },
        },
      }),
    ]);

    if (!baseMaturity || !targetMaturity) {
      return NextResponse.json({ error: "One or both analyses not found" }, { status: 404 });
    }

    const userId = session.user.id;
    const isAdmin = isSuperadmin(session.user.role);
    if (
      (baseMaturity.userId !== userId && !isAdmin) ||
      (targetMaturity.userId !== userId && !isAdmin)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Matching: Items werden über title+category verglichen
    const baseItems = baseMaturity.items;
    const targetItems = targetMaturity.items;

    const baseMap = new Map(baseItems.map((i) => [`${i.category}|||${i.title}`, i]));
    const targetMap = new Map(targetItems.map((i) => [`${i.category}|||${i.title}`, i]));

    const allKeys = new Set([...baseMap.keys(), ...targetMap.keys()]);

    const differences: Array<{
      category: string;
      title: string;
      type: "added" | "removed" | "changed" | "unchanged";
      baseScore?: number;
      targetScore?: number;
      scoreDiff?: number;
      basePriority?: string | null;
      targetPriority?: string | null;
      baseTeams?: string[];
      targetTeams?: string[];
    }> = [];

    for (const key of allKeys) {
      const baseItem = baseMap.get(key);
      const targetItem = targetMap.get(key);
      const [category, title] = key.split("|||");

      if (!baseItem && targetItem) {
        differences.push({
          category,
          title,
          type: "added",
          targetScore: targetItem.score,
          targetPriority: targetItem.priority,
          targetTeams: targetItem.teams.map((t: any) => t.team.name),
        });
      } else if (baseItem && !targetItem) {
        differences.push({
          category,
          title,
          type: "removed",
          baseScore: baseItem.score,
          basePriority: baseItem.priority,
          baseTeams: baseItem.teams.map((t: any) => t.team.name),
        });
      } else if (baseItem && targetItem) {
        const scoreDiff = targetItem.score - baseItem.score;
        const hasChange =
          scoreDiff !== 0 ||
          baseItem.priority !== targetItem.priority ||
          JSON.stringify(baseItem.teams.map((t: any) => t.team.id).sort()) !==
            JSON.stringify(targetItem.teams.map((t: any) => t.team.id).sort());

        differences.push({
          category,
          title,
          type: hasChange ? "changed" : "unchanged",
          baseScore: baseItem.score,
          targetScore: targetItem.score,
          scoreDiff,
          basePriority: baseItem.priority,
          targetPriority: targetItem.priority,
          baseTeams: baseItem.teams.map((t: any) => t.team.name),
          targetTeams: targetItem.teams.map((t: any) => t.team.name),
        });
      }
    }

    // Zusammenfassung
    const avgBaseScore = baseItems.length > 0
      ? baseItems.reduce((s, i) => s + i.score, 0) / baseItems.length
      : 0;
    const avgTargetScore = targetItems.length > 0
      ? targetItems.reduce((s, i) => s + i.score, 0) / targetItems.length
      : 0;

    return NextResponse.json({
      base: { id: baseMaturity.id, name: baseMaturity.name, itemCount: baseItems.length, avgScore: avgBaseScore },
      target: { id: targetMaturity.id, name: targetMaturity.name, itemCount: targetItems.length, avgScore: avgTargetScore },
      differences: differences.sort((a, b) => {
        const typeOrder = { removed: 0, added: 1, changed: 2, unchanged: 3 };
        return typeOrder[a.type] - typeOrder[b.type] || a.category.localeCompare(b.category);
      }),
      summary: {
        added: differences.filter((d) => d.type === "added").length,
        removed: differences.filter((d) => d.type === "removed").length,
        changed: differences.filter((d) => d.type === "changed").length,
        unchanged: differences.filter((d) => d.type === "unchanged").length,
        avgScoreDiff: avgTargetScore - avgBaseScore,
      },
    });
  } catch (error) {
    console.error("Error comparing maturities:", error);
    return NextResponse.json(
      { error: "Failed to compare analyses" },
      { status: 500 }
    );
  }
}
