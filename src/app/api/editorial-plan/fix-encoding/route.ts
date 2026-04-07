import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import { fixMojibake } from "@/lib/editorial-text-encoding";

const TEXT_FIELDS = ["title", "description", "metaDescription", "h1", "schemaMarkup"] as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !canEdit(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const articles = await prisma.editorialPlanArticle.findMany({
      select: { id: true, title: true, description: true, metaDescription: true, h1: true, schemaMarkup: true },
    });

    let totalAffected = 0;
    const preview: Array<{ id: string; field: string; before: string; after: string }> = [];

    for (const article of articles) {
      for (const field of TEXT_FIELDS) {
        const value = article[field];
        if (!value) continue;
        const fixed = fixMojibake(value);
        if (fixed !== value) {
          totalAffected++;
          if (preview.length < 20) {
            preview.push({
              id: article.id,
              field,
              before: value.substring(0, 200),
              after: fixed.substring(0, 200),
            });
          }
        }
      }
    }

    return NextResponse.json({
      totalArticles: articles.length,
      totalFieldsAffected: totalAffected,
      preview,
    });
  } catch (error) {
    console.error("Error in fix-encoding GET:", error);
    return NextResponse.json({ error: "Fehler beim Analysieren" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || !canEdit(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const articles = await prisma.editorialPlanArticle.findMany({
      select: { id: true, title: true, description: true, metaDescription: true, h1: true, schemaMarkup: true },
    });

    let fixedFields = 0;
    let fixedArticles = 0;

    for (const article of articles) {
      const updates: Record<string, string> = {};

      for (const field of TEXT_FIELDS) {
        const value = article[field];
        if (!value) continue;
        const fixed = fixMojibake(value);
        if (fixed !== value) {
          updates[field] = fixed;
          fixedFields++;
        }
      }

      if (Object.keys(updates).length > 0) {
        await prisma.editorialPlanArticle.update({
          where: { id: article.id },
          data: updates,
        });
        fixedArticles++;
      }
    }

    return NextResponse.json({
      totalArticles: articles.length,
      fixedArticles,
      fixedFields,
    });
  } catch (error) {
    console.error("Error in fix-encoding POST:", error);
    return NextResponse.json({ error: "Fehler beim Reparieren" }, { status: 500 });
  }
}
