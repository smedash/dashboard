import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";

/**
 * Windows-1252 byte values for the 0x80–0x9F range that differ from Latin-1.
 * Maps Unicode code points back to their original Windows-1252 byte values.
 */
const WIN1252_REVERSE: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201c: 0x93, // "
  0x201d: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

function hasMojibake(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp >= 0xc0 && cp <= 0xff) return true;
  }
  return false;
}

function fixMojibake(text: string): string {
  if (!hasMojibake(text)) return text;

  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);

    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp >= 0xa0 && cp <= 0xff) {
      bytes.push(cp);
    } else {
      const win1252byte = WIN1252_REVERSE[cp];
      if (win1252byte !== undefined) {
        bytes.push(win1252byte);
      } else {
        return text;
      }
    }
  }

  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
      new Uint8Array(bytes)
    );
    if (decoded !== text) return decoded;
  } catch {
    // bytes don't form valid UTF-8, not mojibake
  }

  return text;
}

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
