/** Escape a value for safe interpolation into HTML text or a quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Filename safe for a Content-Disposition header (no quotes, CR/LF or path separators). */
export function safeHeaderFilename(name: string, fallback = 'download'): string {
  const cleaned = name.replace(/[\r\n"\\/]/g, '').replace(/[^\x20-\x7E]/g, '_').trim().slice(0, 150)
  return cleaned || fallback
}
