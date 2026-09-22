import { jsPDF } from "jspdf";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { STATUS_CONFIG, describeHistoryEntry } from "@/lib/content-workflow";

export interface ReviewPdfComment {
  selectedText: string;
  commentText: string;
  role: string;
  resolved: boolean;
  author: { name: string | null; email: string };
  resolvedBy?: { name: string | null; email: string } | null;
  createdAt: string;
}

export interface ReviewPdfHistoryEntry {
  fromStatus: string;
  toStatus: string;
  changedByEmail?: string;
  changedByName: string | null;
  comment: string | null;
  createdAt: string;
}

export interface ReviewPdfArticle {
  title: string;
  slug: string;
  contentNumber?: number;
  funnelStage: string;
  category: string;
  targetAudience: string;
  htmlContent: string;
  wordCount: number;
  reviewStatus: string;
  createdAt?: string;
  comments?: ReviewPdfComment[];
  statusHistory?: ReviewPdfHistoryEntry[];
  creator?: { name: string | null; email: string };
}

function pdfSafe(text: string): string {
  return text
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/→/g, "->");
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "  - ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<td[^>]*>/gi, " | ")
    .replace(/<th[^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#\d+;/g, "")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
    .replace(/[\u2000-\u200A]/g, " ")
    .replace(/\u2028|\u2029/g, "\n")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, "-")
    .replace(/[\u2713\u2714\u2715\u2716\u2717\u2718\u2610\u2611\u2612]/g, "")
    .replace(/[\u25A0-\u25FF]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function statusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label || status;
}

export function downloadContentReviewPdf(article: ReviewPdfArticle) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = 20;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 25) {
      doc.addPage();
      y = 20;
    }
  };

  y = 60;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("CONTENT REVIEW - REVISIONSARCHIV", margin, y);
  y += 16;

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  const numberPrefix = article.contentNumber ? `#${article.contentNumber} ` : "";
  const titleLines = doc.splitTextToSize(pdfSafe(`${numberPrefix}${article.title}`), contentWidth);
  for (const line of titleLines) {
    doc.text(line, margin, y);
    y += 10;
  }
  y += 8;

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + 40, y);
  y += 14;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const createdBy = article.creator?.name || article.creator?.email || "-";
  const createdAt = article.createdAt
    ? new Date(article.createdAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";
  const metaFields = [
    `Kategorie: ${article.category}`,
    `Funnel-Stage: ${article.funnelStage}`,
    `Zielgruppe: ${article.targetAudience}`,
    `Wortanzahl: ${article.wordCount}`,
    `Erstellt von: ${createdBy}`,
    `Erstellt am: ${createdAt}`,
    `Status: ${statusLabel(article.reviewStatus)}`,
  ];
  for (const field of metaFields) {
    doc.text(pdfSafe(field), margin, y);
    y += 6;
  }

  doc.addPage();
  y = 20;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Artikelinhalt", margin, y);
  y += 10;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const plainText = htmlToPlainText(article.htmlContent);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);

  const paragraphs = plainText.split("\n\n");
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const subLines = trimmed.split("\n");
    for (const subLine of subLines) {
      const sub = subLine.trim();
      if (!sub) continue;
      const lines = doc.splitTextToSize(pdfSafe(sub), contentWidth);
      for (const line of lines) {
        checkPageBreak(5);
        doc.text(line, margin, y);
        y += 4.5;
      }
    }
    y += 3;
  }

  const comments = article.comments || [];
  if (comments.length > 0) {
    doc.addPage();
    y = 20;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Kommentare", margin, y);
    y += 10;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    for (const comment of comments) {
      checkPageBreak(30);

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      const roleLabel = ROLE_LABELS[comment.role as Role] || comment.role;
      const author = comment.author.name || comment.author.email;
      const date = new Date(comment.createdAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const resolvedByInfo =
        comment.resolved && comment.resolvedBy
          ? ` von ${comment.resolvedBy.name || comment.resolvedBy.email}`
          : "";
      const status = comment.resolved ? ` [ERLEDIGT${resolvedByInfo}]` : " [OFFEN]";
      doc.text(pdfSafe(`${roleLabel} | ${author} | ${date}${status}`), margin, y);
      y += 5;

      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(146, 64, 14);
      const selectedLines = doc.splitTextToSize(pdfSafe(`"${comment.selectedText}"`), contentWidth);
      for (const line of selectedLines) {
        checkPageBreak(5);
        doc.text(line, margin, y);
        y += 4;
      }
      y += 2;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      const commentLines = doc.splitTextToSize(pdfSafe(comment.commentText), contentWidth);
      for (const line of commentLines) {
        checkPageBreak(5);
        doc.text(line, margin, y);
        y += 4.5;
      }

      y += 4;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    }
  }

  doc.addPage();
  y = 20;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Aenderungsverlauf", margin, y);
  y += 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Vollstaendige Dokumentation aller Aenderungen zu Revisionszwecken", margin, y);
  y += 8;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const history = article.statusHistory || [];

  if (history.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Keine Aenderungen protokolliert.", margin, y);
  } else {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4, contentWidth, 8, "F");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("DATUM / UHRZEIT", margin + 2, y);
    doc.text("AKTION", margin + 38, y);
    doc.text("STATUS", margin + 95, y);
    doc.text("VON", margin + 135, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);

    for (const entry of history) {
      checkPageBreak(8);

      const entryDate = new Date(entry.createdAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const changedBy = entry.changedByName || entry.changedByEmail || "-";
      const described = describeHistoryEntry(entry);

      doc.setFontSize(7.5);
      doc.text(entryDate, margin + 2, y);
      doc.text(pdfSafe(described.action), margin + 38, y);
      const statusLines = doc.splitTextToSize(pdfSafe(described.status), 38);
      doc.text(statusLines[0], margin + 95, y);
      const nameLines = doc.splitTextToSize(pdfSafe(changedBy), 32);
      doc.text(nameLines[0], margin + 135, y);

      y += 6;
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.15);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(
      pdfSafe(`SEO Dashboard - Content Review | ${article.title} | Seite ${i} von ${totalPages}`),
      margin,
      pageHeight - 10
    );
    doc.text(
      `Generiert am ${new Date().toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      pageWidth - margin - 55,
      pageHeight - 10
    );
  }

  const slug = article.slug || article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`content-review-${slug}.pdf`);
}
