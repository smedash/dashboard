import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { hasFullAdminRights } from "@/lib/rbac";
import { slugify, countWords } from "@/lib/content-workflow";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  if (!hasFullAdminRights(session.user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const articles = await prisma.generatedArticle.findMany({
    orderBy: { createdAt: "desc" },
    include: { creator: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(articles);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  if (!hasFullAdminRights(session.user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  const body = await request.json();
  const {
    title,
    funnelStage,
    category,
    location,
    language,
    targetAudience,
    htmlContent,
    metaTitle,
    metaDescription,
    editorialPlanArticleId,
  } = body;

  if (!title || !funnelStage || !category || !targetAudience || !htmlContent) {
    return NextResponse.json(
      { error: "Alle Felder sind erforderlich" },
      { status: 400 }
    );
  }

  let slug = slugify(title);
  const existing = await prisma.generatedArticle.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  const lastArticle = await prisma.generatedArticle.findFirst({
    orderBy: { contentNumber: "desc" },
    select: { contentNumber: true },
  });
  const nextNumber = (lastArticle?.contentNumber ?? 0) + 1;

  const article = await prisma.generatedArticle.create({
    data: {
      title,
      slug,
      funnelStage,
      category,
      location: location || null,
      language: language || null,
      targetAudience,
      htmlContent,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      wordCount: countWords(htmlContent),
      creatorId: user.id,
      contentNumber: nextNumber,
    },
    include: { creator: { select: { id: true, name: true, email: true } } },
  });

  if (editorialPlanArticleId) {
    await prisma.editorialPlanArticle
      .update({
        where: { id: editorialPlanArticleId },
        data: { articleId: article.id },
      })
      .catch(() => {});
  }

  return NextResponse.json(article, { status: 201 });
}
