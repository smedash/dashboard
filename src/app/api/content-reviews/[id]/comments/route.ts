import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { COMMENT_ROLES } from "@/lib/content-workflow";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const comments = await prisma.contentComment.findMany({
    where: { articleId: id },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(comments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  const { id } = await params;
  const body = await request.json();
  const {
    selectedText,
    commentText,
    role,
    changeAndForward,
    recheckAfterRevision,
    anchorId,
    textOffset,
    contextPrefix,
    contextSuffix,
    paragraphIndex,
  } = body;

  if (!selectedText || !commentText || !role) {
    return NextResponse.json(
      { error: "selectedText, commentText und role sind erforderlich" },
      { status: 400 }
    );
  }

  if (!(COMMENT_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json(
      { error: "Ungültige Kommentar-Rolle" },
      { status: 400 }
    );
  }

  const comment = await prisma.contentComment.create({
    data: {
      articleId: id,
      authorId: user.id,
      selectedText,
      commentText,
      role,
      changeAndForward: changeAndForward === true,
      recheckAfterRevision: recheckAfterRevision === true,
      anchorId: typeof anchorId === "string" ? anchorId : undefined,
      textOffset: typeof textOffset === "number" ? textOffset : undefined,
      contextPrefix: typeof contextPrefix === "string" ? contextPrefix : undefined,
      contextSuffix: typeof contextSuffix === "string" ? contextSuffix : undefined,
      paragraphIndex: typeof paragraphIndex === "number" ? paragraphIndex : undefined,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (typeof anchorId === "string" && anchorId) {
    try {
      const article = await prisma.generatedArticle.findUnique({
        where: { id },
        select: { htmlContent: true },
      });
      if (article) {
        const anchorSpan = `<span data-comment-anchor="${anchorId}" style="display:contents"></span>`;
        const textIdx = article.htmlContent.indexOf(selectedText);
        if (textIdx >= 0) {
          const updatedHtml =
            article.htmlContent.substring(0, textIdx) +
            anchorSpan +
            article.htmlContent.substring(textIdx);
          await prisma.generatedArticle.update({
            where: { id },
            data: { htmlContent: updatedHtml },
          });
        }
      }
    } catch {
      // Anchor injection is best-effort
    }
  }

  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get("commentId");

  if (!commentId) {
    return NextResponse.json({ error: "commentId ist erforderlich" }, { status: 400 });
  }

  const { id } = await params;

  const commentToDelete = await prisma.contentComment.findUnique({
    where: { id: commentId },
    select: { anchorId: true },
  });

  await prisma.contentComment.delete({ where: { id: commentId } });

  if (commentToDelete?.anchorId) {
    try {
      const article = await prisma.generatedArticle.findUnique({
        where: { id },
        select: { htmlContent: true },
      });
      if (article) {
        const anchorPattern = `<span data-comment-anchor="${commentToDelete.anchorId}" style="display:contents"></span>`;
        if (article.htmlContent.includes(anchorPattern)) {
          await prisma.generatedArticle.update({
            where: { id },
            data: { htmlContent: article.htmlContent.replace(anchorPattern, "") },
          });
        }
      }
    } catch {
      // Anchor removal is best-effort
    }
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const body = await request.json();
  const { commentId, resolved } = body;

  if (!commentId || typeof resolved !== "boolean") {
    return NextResponse.json(
      { error: "commentId und resolved sind erforderlich" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  const comment = await prisma.contentComment.update({
    where: { id: commentId },
    data: {
      resolved,
      resolvedById: resolved ? user.id : null,
      resolvedAt: resolved ? new Date() : null,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(comment);
}
