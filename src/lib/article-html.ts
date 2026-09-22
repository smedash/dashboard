export const ARTICLE_STYLE_BLOCK = `<style id="ubs-article-styles">
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #1c1c1c;
    font-family: Frutiger, Arial, Helvetica, sans-serif;
    font-weight: 300;
    font-size: 16px;
    line-height: 1.625;
  }
  article, body {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 24px 80px;
  }
  .title-block {
    border-left: 4px solid #E60000;
    padding-left: 20px;
    margin: 0 0 28px;
  }
  h1 {
    font-size: 32px;
    font-weight: 300;
    line-height: 1.25;
    margin: 0 0 12px;
    color: #1c1c1c;
  }
  .intro {
    font-size: 20px;
    font-weight: 300;
    line-height: 1.4;
    margin: 0 0 16px;
    color: #1c1c1c;
  }
  .meta {
    font-size: 13px;
    font-weight: 300;
    color: #5a5a5a;
    margin: 0;
  }
  .meta a,
  .meta .category {
    color: #E60000;
    text-decoration: underline;
  }
  h2 {
    font-size: 28px;
    font-weight: 300;
    line-height: 1.2;
    margin: 48px 0 16px;
    color: #1c1c1c;
  }
  h3 {
    font-size: 22px;
    font-weight: 300;
    line-height: 1.3;
    margin: 32px 0 12px;
    color: #1c1c1c;
  }
  p { margin: 0 0 16px; }
  a { color: #1c1c1c; text-decoration: underline; }
  a:hover { color: #E60000; }
  ul, ol { margin: 0 0 16px; padding-left: 1.25em; }
  li { margin-bottom: 0.4em; }
  .toc {
    background: #f6f6f6;
    padding: 28px 32px;
    margin: 32px 0 40px;
  }
  .toc h2,
  .toc .toc-title {
    font-size: 22px;
    font-weight: 300;
    margin: 0 0 16px;
  }
  .toc ul { list-style: none; padding: 0; margin: 0; }
  .toc li {
    padding: 6px 0 6px 22px;
    position: relative;
    margin: 0;
  }
  .toc li::before {
    content: "\\2193";
    position: absolute;
    left: 0;
    color: #1c1c1c;
  }
  .toc a {
    color: #1c1c1c;
    text-decoration: none;
    border-bottom: 1px solid #1c1c1c;
  }
  .toc a:hover { color: #E60000; border-bottom-color: #E60000; }
  .highlight-box,
  .definition-box,
  .example-box {
    background: #f6f6f6;
    padding: 20px 24px;
    margin: 24px 0;
  }
  .tip-box {
    border-left: 4px solid #1c1c1c;
    padding: 16px 20px;
    margin: 24px 0;
    background: #f6f6f6;
  }
  .warning-box {
    border-left: 4px solid #E60000;
    padding: 16px 20px;
    margin: 24px 0;
    background: #fff5f5;
  }
  .cta-box {
    background: #f6f6f6;
    padding: 32px;
    margin: 40px 0;
  }
  .cta-box h2 { margin-top: 0; }
  .cta-box a {
    color: #E60000;
  }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th {
    text-align: left;
    font-weight: 400;
    border-bottom: 1px solid #1c1c1c;
    padding: 10px 8px;
  }
  td {
    padding: 10px 8px;
    border-bottom: 1px solid #e6e6e6;
  }
  .faq-item {
    border-top: 1px solid #e6e6e6;
    padding: 16px 0;
  }
  .faq-question {
    font-weight: 400;
    margin: 0 0 8px;
    color: #1c1c1c;
  }
  .legal-disclaimer,
  .example-disclaimer {
    font-size: 13px;
    color: #5a5a5a;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #e6e6e6;
  }
</style>`;

export function applyCanonicalArticleStyles(html: string): string {
  if (!html?.trim()) return html;

  const withoutStyle = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").trim();
  const withTitleBlock = ensureTitleBlock(withoutStyle);

  if (/<\/head>/i.test(withTitleBlock)) {
    return withTitleBlock.replace(/<\/head>/i, `${ARTICLE_STYLE_BLOCK}\n</head>`);
  }

  const bodyMatch = withTitleBlock.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const inner = bodyMatch
    ? bodyMatch[1].trim()
    : withTitleBlock
        .replace(/<!DOCTYPE[^>]*>/i, "")
        .replace(/<\/?html[^>]*>/gi, "")
        .replace(/<head[^>]*>[\s\S]*<\/head>/i, "")
        .trim();

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${ARTICLE_STYLE_BLOCK}
</head>
<body>
${inner}
</body>
</html>`;
}

function ensureTitleBlock(html: string): string {
  if (/class=["'][^"']*\btitle-block\b/.test(html)) return html;
  return html.replace(
    /<h1([^>]*)>([\s\S]*?)<\/h1>(\s*<p class=["']intro["'][\s\S]*?<\/p>)?/i,
    `<header class="title-block"><h1$1>$2</h1>$3</header>`
  );
}
