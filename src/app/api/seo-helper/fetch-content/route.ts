import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "URL ist erforderlich" },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "Ungültige URL" },
        { status: 400 }
      );
    }

    // Fetch the URL with realistic browser headers
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "de-CH,de-DE;q=0.9,de;q=0.8,en-US;q=0.7,en;q=0.6",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout for slow sites
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Fehler beim Laden: HTTP ${response.status}` },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Extract text content from HTML
    const content = extractTextContent(html);
    const title = extractTitle(html);
    const metaDescription = extractMetaDescription(html);
    const headings = extractHeadings(html);

    return NextResponse.json({
      content,
      title,
      metaDescription,
      headings,
      url: parsedUrl.href,
    });
  } catch (error) {
    console.error("Error fetching URL:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der URL. Bitte überprüfe die URL und versuche es erneut." },
      { status: 500 }
    );
  }
}

function extractTextContent(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");
  
  // Remove comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  
  // Try to extract main content area
  const mainContentPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  let mainContent = text;
  for (const pattern of mainContentPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length > 200) {
      mainContent = match[1];
      break;
    }
  }

  // Remove header, footer, nav
  mainContent = mainContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");
  mainContent = mainContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  mainContent = mainContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  mainContent = mainContent.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");

  // Convert block elements to newlines
  mainContent = mainContent.replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, "\n");
  mainContent = mainContent.replace(/<(br|hr)[^>]*\/?>/gi, "\n");
  
  // Remove all remaining HTML tags
  mainContent = mainContent.replace(/<[^>]+>/g, " ");
  
  // Decode HTML entities
  mainContent = decodeHtmlEntities(mainContent);
  
  // Clean up whitespace
  mainContent = mainContent.replace(/[ \t]+/g, " ");
  mainContent = mainContent.replace(/\n[ \t]+/g, "\n");
  mainContent = mainContent.replace(/[ \t]+\n/g, "\n");
  mainContent = mainContent.replace(/\n{3,}/g, "\n\n");
  mainContent = mainContent.trim();

  return mainContent;
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    return decodeHtmlEntities(titleMatch[1].trim());
  }
  
  // Try og:title
  const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i) ||
                       html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"[^>]*>/i);
  if (ogTitleMatch) {
    return decodeHtmlEntities(ogTitleMatch[1].trim());
  }

  return "";
}

function extractMetaDescription(html: string): string {
  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i) ||
                    html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"[^>]*>/i);
  if (descMatch) {
    return decodeHtmlEntities(descMatch[1].trim());
  }

  // Try og:description
  const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i) ||
                      html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"[^>]*>/i);
  if (ogDescMatch) {
    return decodeHtmlEntities(ogDescMatch[1].trim());
  }

  return "";
}

function extractHeadings(html: string): { level: string; text: string }[] {
  const headings: { level: string; text: string }[] = [];
  
  // Only remove nav elements - they contain navigation links, not content headings
  // IMPORTANT: Don't remove <header> or <footer> as they often contain the main H1!
  // Many modern websites put the page title H1 inside a <header> element
  let cleanHtml = html;
  cleanHtml = cleanHtml.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  
  // Regex that matches h1-h6 tags with any attributes (class, id, style, data-*, etc.)
  // Pattern: <h1 ...any attributes...>content</h1>
  const headingRegex = /<h([1-6])(?:\s+[^>]*|\s*)>([\s\S]*?)<\/h\1\s*>/gi;
  
  let match;
  while ((match = headingRegex.exec(cleanHtml)) !== null) {
    const level = `H${match[1]}`;
    let text = match[2];
    
    // Replace closing tags with space to separate words
    text = text.replace(/<\/[^>]+>/g, " ");
    // Remove remaining opening tags
    text = text.replace(/<[^>]+>/g, "");
    // Decode HTML entities
    text = decodeHtmlEntities(text);
    // Normalize whitespace
    text = text.replace(/\s+/g, " ").trim();
    
    // Skip empty headings or those that are too long (likely remnants)
    if (text && text.length > 0 && text.length <= 200) {
      headings.push({ level, text });
    }
  }

  return headings;
}

function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&#39;": "'",
    "&ndash;": "–",
    "&mdash;": "—",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&hellip;": "…",
    "&euro;": "€",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
    "&auml;": "ä",
    "&ouml;": "ö",
    "&uuml;": "ü",
    "&Auml;": "Ä",
    "&Ouml;": "Ö",
    "&Uuml;": "Ü",
    "&szlig;": "ß",
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, "g"), char);
  }

  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => 
    String.fromCharCode(parseInt(code, 10))
  );
  decoded = decoded.replace(/&#x([a-fA-F0-9]+);/g, (_, code) => 
    String.fromCharCode(parseInt(code, 16))
  );

  return decoded;
}
