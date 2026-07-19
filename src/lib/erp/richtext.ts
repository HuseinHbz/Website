/**
 * Rich-text sanitizer (Phase 26.10) — the contract body is authored in a
 * Word-like editor and stored as HTML, so it MUST be sanitized before it lands
 * in a generated document. Pure, dependency-free, allowlist-based: only a small
 * set of formatting tags survive, every attribute is dropped except a
 * re-validated inline `style`, and scripts / event handlers / `javascript:`
 * URLs are removed. Runs on the server (Node, no DOM) during render.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'div', 'span', 'blockquote',
])
// Inline style properties we permit, each with a value validator.
const STYLE_PROPS: Record<string, (v: string) => boolean> = {
  'text-align': v => /^(left|right|center|justify)$/.test(v),
  'font-size': v => /^\d{1,2}(\.\d)?(px|pt|em|rem)$/.test(v),
  'font-weight': v => /^(normal|bold|[1-9]00)$/.test(v),
  'font-style': v => /^(normal|italic)$/.test(v),
  'text-decoration': v => /^(none|underline|line-through)$/.test(v),
  'color': v => /^#[0-9a-fA-F]{3,8}$/.test(v),
  'direction': v => /^(rtl|ltr)$/.test(v),
}

/** Re-emit only the allowlisted, validated style declarations. */
function sanitizeStyle(raw: string): string {
  const out: string[] = []
  for (const decl of raw.split(';')) {
    const idx = decl.indexOf(':')
    if (idx < 0) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const val = decl.slice(idx + 1).trim().toLowerCase()
    if (STYLE_PROPS[prop]?.(val)) out.push(`${prop}: ${val}`)
  }
  return out.join('; ')
}

/**
 * Sanitize author HTML to a safe subset. Disallowed tags are dropped but their
 * text content is kept; allowed tags keep only a sanitized `style`.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return ''
  let s = String(html)
  // Strip whole dangerous elements (with content), comments, CDATA.
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta|svg|math)\b[^>]*>/gi, '')
  // Process every remaining tag.
  s = s.replace(/<\/?([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (_m, rawName: string, rawAttrs: string) => {
    const name = rawName.toLowerCase()
    const closing = _m.startsWith('</')
    if (!ALLOWED_TAGS.has(name)) return '' // drop tag, keep inner text
    if (closing) return `</${name}>`
    // Keep only a sanitized style attribute; drop everything else (incl. on*, href, src).
    const styleMatch = /\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i.exec(rawAttrs)
    const style = styleMatch ? sanitizeStyle(styleMatch[2] ?? styleMatch[3] ?? '') : ''
    const selfClose = name === 'br' ? ' /' : ''
    return style ? `<${name} style="${style}"${selfClose}>` : `<${name}${selfClose}>`
  })
  // Neutralise any javascript: that survived inside text (defensive).
  s = s.replace(/javascript:/gi, '')
  return s.trim()
}

/** True when a string looks like it contains HTML markup (vs plain text). */
export function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s)
}
