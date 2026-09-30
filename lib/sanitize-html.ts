import DOMPurify from "dompurify";

/**
 * Strips scripts, event-handler attributes and javascript: URLs from HTML before it is
 * written into the DOM. Use for any HTML that comes from the API or user input
 * (e.g. email template bodies). Returns "" during SSR, where there is no DOM to sanitize with.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html);
}
