import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const articles = await prisma.generatedArticle.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      _count: {
        select: {
          comments: true,
        },
      },
    },
  });

  const articleIds = articles.map((a) => a.id);
  const unresolvedGroups = articleIds.length
    ? await prisma.contentComment.groupBy({
        by: ["articleId"],
        where: { articleId: { in: articleIds }, resolved: false },
        _count: { _all: true },
      })
    : [];
  const unresolvedById = new Map(
    unresolvedGroups.map((g) => [g.articleId, g._count._all])
  );

  const articlesWithCommentCounts = articles.map((article) => {
    const unresolvedCount = unresolvedById.get(article.id) ?? 0;
    return {
      ...article,
      _count: {
        ...article._count,
        unresolvedComments: unresolvedCount,
        resolvedComments: article._count.comments - unresolvedCount,
      },
    };
  });

  return NextResponse.json(articlesWithCommentCounts);
}
