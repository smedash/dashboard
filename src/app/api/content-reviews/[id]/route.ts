import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { sendContentReviewNotification } from "@/lib/resend";
import { canEditContentRole, hasFullAdminRights } from "@/lib/rbac";
import { computeReviewStepDueAt } from "@/lib/review-deadline";
import { articleDetailInclude } from "@/lib/article-include";
import {
  VALID_TRANSITIONS,
  STATUS_NOTIFY_ROLES,
  STATUS_RESPONSIBLE_ROLE,
  REVIEW_STATUSES,
  canTransitionStatus,
  countWords,
} from "@/lib/content-workflow";

async function notifyStatusChange(opts: {
  articleId: string;
  articleTitle: string;
  newStatus: string;
  changedByName: string;
}) {
  const notifyRoles = STATUS_NOTIFY_ROLES[opts.newStatus];
  if (!notifyRoles?.length) return;

  try {
    const recipients = await prisma.user.findMany({
      where: { role: { in: notifyRoles } },
      select: { email: true },
    });
    const baseUrl = process.env.NEXTAUTH_URL || "https://dashboard.tasketeer.com";
    const dashboardUrl = `${baseUrl}/content-check?article=${opts.articleId}`;

    await Promise.allSettled(
      recipients.map((recipient) =>
        sendContentReviewNotification({
          to: recipient.email,
          articleTitle: opts.articleTitle,
          newStatus: opts.newStatus,
          changedByName: opts.changedByName,
          dashboardUrl,
        })
      )
    );
  } catch (emailError) {
    console.error("Error sending content review notifications:", emailError);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const article = await prisma.generatedArticle.findUnique({
    where: { id },
    include: articleDetailInclude,
  });

  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(article);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const {
    reviewStatus,
    htmlContent,
    metaTitle,
    metaDescription,
    resolveRevision,
    claim,
    resetToStatus,
    pdfApproved,
  } = body;

  const article = await prisma.generatedArticle.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  }

  if (claim !== undefined && !reviewStatus) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true },
    });

    const updated = await prisma.generatedArticle.update({
      where: { id },
      data: claim
        ? {
            claimedAt: new Date(),
            claimedByUserId: user!.id,
            claimedByName: user!.name || user!.email,
          }
        : {
            claimedAt: null,
            claimedByUserId: null,
            claimedByName: null,
          },
      include: articleDetailInclude,
    });

    return NextResponse.json(updated);
  }

  if (resolveRevision !== undefined && !reviewStatus) {
    if (!canEditContentRole(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
    if (!article.revisionRequestedAt) {
      return NextResponse.json(
        { error: "Keine offene Überarbeitung vorhanden" },
        { status: 400 }
      );
    }

    const resolvedByUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { name: true, email: true },
    });
    const resolvedByName = resolvedByUser?.name || resolvedByUser?.email || "Unbekannt";

    await prisma.generatedArticle.update({
      where: { id },
      data: {
        revisionRequestedAt: null,
        revisionRequestedBy: null,
      },
    });

    await prisma.articleStatusHistory.create({
      data: {
        articleId: id,
        fromStatus: article.reviewStatus,
        toStatus: article.reviewStatus,
        changedByEmail: session.user.email,
        changedByName: resolvedByName,
        comment: "revision_resolved",
      },
    });

    const responsibleRole = STATUS_RESPONSIBLE_ROLE[article.reviewStatus];
    if (responsibleRole) {
      await notifyStatusChange({
        articleId: id,
        articleTitle: article.title,
        newStatus: article.reviewStatus,
        changedByName: resolvedByName,
      });
    }

    const refreshed = await prisma.generatedArticle.findUnique({
      where: { id },
      include: articleDetailInclude,
    });

    return NextResponse.json(refreshed);
  }

  if ((htmlContent !== undefined || metaTitle !== undefined || metaDescription !== undefined) && !reviewStatus) {
    if (!canEditContentRole(session.user.role)) {
      return NextResponse.json(
        { error: "Nur Agentur- und Superadmin-User können den Inhalt bearbeiten" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};
    if (htmlContent !== undefined) {
      data.htmlContent = htmlContent;
      data.wordCount = countWords(htmlContent);
    }
    if (metaTitle !== undefined) data.metaTitle = metaTitle;
    if (metaDescription !== undefined) data.metaDescription = metaDescription;

    const changedByUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { name: true, email: true },
    });
    const changedByName = changedByUser?.name || changedByUser?.email || "Unbekannt";

    await prisma.generatedArticle.update({
      where: { id },
      data,
    });

    await prisma.articleStatusHistory.create({
      data: {
        articleId: id,
        fromStatus: article.reviewStatus,
        toStatus: article.reviewStatus,
        changedByEmail: session.user.email,
        changedByName,
        comment: "content_updated",
      },
    });

    const updated = await prisma.generatedArticle.findUnique({
      where: { id },
      include: articleDetailInclude,
    });

    return NextResponse.json(updated);
  }

  if (pdfApproved !== undefined && !reviewStatus) {
    if (!canEditContentRole(session.user.role)) {
      return NextResponse.json(
        { error: "Nur Agentur- und Superadmin-User können das Revisions-PDF freigeben" },
        { status: 403 }
      );
    }

    if (article.reviewStatus !== "approved" && article.reviewStatus !== "published") {
      return NextResponse.json(
        { error: "PDF-Freigabe kann nur im Status Freigegeben oder Publiziert gesetzt werden" },
        { status: 400 }
      );
    }

    const userName = session.user.name || session.user.email || "Unbekannt";

    await prisma.generatedArticle.update({
      where: { id },
      data: {
        pdfApprovedAt: pdfApproved ? new Date() : null,
        pdfApprovedBy: pdfApproved ? userName : null,
      },
    });

    await prisma.articleStatusHistory.create({
      data: {
        articleId: id,
        fromStatus: article.reviewStatus,
        toStatus: article.reviewStatus,
        changedByEmail: session.user.email,
        changedByName: userName,
        comment: pdfApproved ? "pdf_approved" : "pdf_unapproved",
      },
    });

    const updated = await prisma.generatedArticle.findUnique({
      where: { id },
      include: articleDetailInclude,
    });

    return NextResponse.json(updated);
  }

  if (resetToStatus && !reviewStatus) {
    if (!hasFullAdminRights(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const STATUS_ORDER = [...REVIEW_STATUSES];
    const currentIndex = STATUS_ORDER.indexOf(article.reviewStatus as (typeof STATUS_ORDER)[number]);
    const targetIndex = STATUS_ORDER.indexOf(resetToStatus);

    if (targetIndex < 0 || targetIndex >= currentIndex) {
      return NextResponse.json(
        { error: `Ungültige Rücksetzung: "${resetToStatus}" ist kein früherer Status als "${article.reviewStatus}"` },
        { status: 400 }
      );
    }

    await prisma.generatedArticle.update({
      where: { id },
      data: {
        reviewStatus: resetToStatus,
        claimedAt: null,
        claimedByUserId: null,
        claimedByName: null,
        revisionRequestedAt: null,
        revisionRequestedBy: null,
        reviewStepDueAt: computeReviewStepDueAt(new Date()),
      },
    });

    const changedByUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { name: true, email: true },
    });
    const changedByName = changedByUser?.name || changedByUser?.email || "Unbekannt";

    await prisma.articleStatusHistory.create({
      data: {
        articleId: id,
        fromStatus: article.reviewStatus,
        toStatus: resetToStatus,
        changedByEmail: session.user.email,
        changedByName,
        comment: "status_reset",
      },
    });

    await notifyStatusChange({
      articleId: id,
      articleTitle: article.title,
      newStatus: resetToStatus,
      changedByName,
    });

    const withHistory = await prisma.generatedArticle.findUnique({
      where: { id },
      include: articleDetailInclude,
    });

    return NextResponse.json(withHistory);
  }

  if (!reviewStatus) {
    return NextResponse.json({ error: "Keine gültige Aktion" }, { status: 400 });
  }

  if (!canTransitionStatus(session.user.role, article.reviewStatus)) {
    return NextResponse.json({ error: "Keine Berechtigung für diesen Statuswechsel" }, { status: 403 });
  }

  if (article.revisionRequestedAt) {
    return NextResponse.json(
      { error: "Der Artikel kann nicht weitergereicht werden, solange eine Überarbeitung angefordert ist." },
      { status: 400 }
    );
  }

  const allowedTransitions = VALID_TRANSITIONS[article.reviewStatus] || [];
  if (!allowedTransitions.includes(reviewStatus)) {
    return NextResponse.json(
      { error: `Ungültiger Statuswechsel von "${article.reviewStatus}" zu "${reviewStatus}"` },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    reviewStatus,
    claimedAt: null,
    claimedByUserId: null,
    claimedByName: null,
  };

  if (reviewStatus === "published") {
    updateData.reviewStepDueAt = null;
    if (article) {
      const linked = await prisma.editorialPlanArticle.findUnique({
        where: { articleId: id },
        select: { id: true },
      });
      if (linked) {
        await prisma.editorialPlanArticle.update({
          where: { id: linked.id },
          data: { status: "published" },
        });
      }
    }
  } else {
    updateData.reviewStepDueAt = computeReviewStepDueAt(new Date());
  }

  await prisma.generatedArticle.update({
    where: { id },
    data: updateData,
  });

  const changedByUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { name: true, email: true },
  });
  const changedByName = changedByUser?.name || changedByUser?.email || "Unbekannt";

  await prisma.articleStatusHistory.create({
    data: {
      articleId: id,
      fromStatus: article.reviewStatus,
      toStatus: reviewStatus,
      changedByEmail: session.user.email,
      changedByName,
    },
  });

  await notifyStatusChange({
    articleId: id,
    articleTitle: article.title,
    newStatus: reviewStatus,
    changedByName,
  });

  const withHistory = await prisma.generatedArticle.findUnique({
    where: { id },
    include: articleDetailInclude,
  });

  return NextResponse.json(withHistory);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  if (!hasFullAdminRights(session.user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.generatedArticle.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
