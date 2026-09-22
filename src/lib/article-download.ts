import { jsPDF } from "jspdf";
import { applyCanonicalArticleStyles } from "@/lib/article-html";
import { normalizeContentLanguage, slugify } from "@/lib/content-workflow";

export type ArticleDownloadSource = {
  title: string;
  slug?: string;
  htmlContent: string;
  language?: string | null;
  category?: string;
  createdAt?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

function fileBaseName(article: ArticleDownloadSource): string {
  return slugify(article.slug || article.title) || "artikel";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&#\d+;/g, "");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
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
    .replace(/→/g, "->")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildArticleHtmlDocument(article: ArticleDownloadSource): string {
  let html = applyCanonicalArticleStyles(article.htmlContent || "", {
    createdAt: article.createdAt,
    language: article.language,
    category: article.category,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
  });
  const lang = normalizeContentLanguage(article.language);
  const pageTitle = article.metaTitle?.trim() || article.title;
  const description = article.metaDescription?.trim();

  if (/<html[^>]*>/i.test(html)) {
    html = html.replace(/<html[^>]*>/i, `<html lang="${lang}">`);
  } else {
    html = `<!DOCTYPE html>\n<html lang="${lang}">\n<head>\n<meta charset="utf-8">\n</head>\n<body>\n${html}\n</body>\n</html>`;
  }

  if (!/<meta\s+charset=/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (open) => `${open}\n<meta charset="utf-8">`);
  }

  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
  } else {
    html = html.replace(/<head[^>]*>/i, (open) => `${open}\n<title>${escapeHtml(pageTitle)}</title>`);
  }

  if (description) {
    if (/<meta\s+name=["']description["']/i.test(html)) {
      html = html.replace(
        /<meta\s+name=["']description["'][^>]*>/i,
        `<meta name="description" content="${escapeHtml(description)}">`
      );
    } else {
      html = html.replace(
        /<title>[\s\S]*?<\/title>/i,
        (titleTag) => `${titleTag}\n<meta name="description" content="${escapeHtml(description)}">`
      );
    }
  }

  return html;
}

export function downloadArticleHtml(article: ArticleDownloadSource) {
  const html = buildArticleHtmlDocument(article);
  triggerDownload(`${fileBaseName(article)}.html`, new Blob([html], { type: "text/html;charset=utf-8" }));
}

type ArticleBlock = { tag: string; text: string };

function htmlToBlocks(html: string): ArticleBlock[] {
  const without = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  const blocks: ArticleBlock[] = [];
  const re = /<(h[1-3]|p|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(without))) {
    const text = stripTags(match[2]);
    if (text) blocks.push({ tag: match[1].toLowerCase(), text });
  }
  return blocks;
}

export function downloadArticlePdf(article: ArticleDownloadSource) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = 24;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = 24;
    }
  };

  const blocks = htmlToBlocks(article.htmlContent || "");
  const title = article.title.trim() || "Artikel";

  doc.setDrawColor(230, 0, 0);
  doc.setFillColor(230, 0, 0);
  doc.rect(margin, y, 1.6, 14, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(28, 28, 28);
  const titleLines = doc.splitTextToSize(pdfSafe(title), contentWidth - 8);
  for (const line of titleLines) {
    checkPageBreak(10);
    doc.text(line, margin + 6, y + 6);
    y += 8;
  }
  y += 10;

  const writeParagraph = (text: string, opts?: { size?: number; bold?: boolean; indent?: number; gap?: number }) => {
    const size = opts?.size ?? 10;
    const indent = opts?.indent ?? 0;
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(28, 28, 28);
    const lines = doc.splitTextToSize(pdfSafe(text), contentWidth - indent);
    for (const line of lines) {
      checkPageBreak(size * 0.5 + 2);
      doc.text(line, margin + indent, y);
      y += size * 0.45 + 1.2;
    }
    y += opts?.gap ?? 3;
  };

  if (blocks.length === 0) {
    writeParagraph(stripTags(article.htmlContent || "Kein Inhalt."));
  } else {
    let skippedTitle = false;
    for (const block of blocks) {
      if (
        !skippedTitle &&
        block.tag === "h1" &&
        block.text.toLowerCase() === title.toLowerCase()
      ) {
        skippedTitle = true;
        continue;
      }
      skippedTitle = true;
      if (block.tag === "h1") {
        writeParagraph(block.text, { size: 16, bold: true, gap: 5 });
      } else if (block.tag === "h2") {
        y += 2;
        writeParagraph(block.text, { size: 13, bold: true, gap: 4 });
      } else if (block.tag === "h3") {
        writeParagraph(block.text, { size: 11, bold: true, gap: 3 });
      } else if (block.tag === "li") {
        writeParagraph(`- ${block.text}`, { size: 10, indent: 4, gap: 1.5 });
      } else if (block.tag === "blockquote") {
        doc.setTextColor(90, 90, 90);
        writeParagraph(block.text, { size: 10, indent: 6, gap: 3 });
      } else {
        writeParagraph(block.text, { size: 10, gap: 3.5 });
      }
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(pdfSafe(title), margin, pageHeight - 10);
    doc.text(`${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }

  doc.save(`${fileBaseName(article)}.pdf`);
}
