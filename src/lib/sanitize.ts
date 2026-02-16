import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = ["strong", "em", "span", "b", "i", "br"];
const ALLOWED_ATTR = ["class"];

/**
 * Sanitizes HTML string to prevent XSS attacks.
 * Only allows safe formatting tags (strong, em, span, b, i, br).
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
