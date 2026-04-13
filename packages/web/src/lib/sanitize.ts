import DOMPurify from 'dompurify'

/** Sanitize untrusted HTML for safe rendering via {@html}. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html)
}
