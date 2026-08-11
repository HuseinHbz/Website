/**
 * Logo upload validation — pure, dependency-free (matches the project's
 * `erp/richtext.ts` pattern: a small hand-written allowlist instead of a new
 * dependency for something this narrow in scope).
 *
 * Two layers, both required:
 *  1. `sniffImageType` — the REAL file type from its magic bytes, never
 *     trusted from the client's declared `file.type`/extension (a renamed
 *     .exe with a .png extension still fails here).
 *  2. `sanitizeSvg` — SVGs are XML that can carry <script>/event-handler
 *     attributes/external references; only a sanitized SVG is ever written
 *     to disk or served.
 */

export type ImageKind = 'png' | 'webp' | 'ico' | 'svg'

const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2MB, per spec

/** Sniff the real file type from magic bytes. Returns null for anything unrecognized. */
export function sniffImageType(buf: Buffer): ImageKind | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png'
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (buf.length >= 4 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) return 'ico'
  // SVG is text, not a fixed binary signature — sniff by content after
  // stripping BOM/whitespace, then require it to actually parse as an <svg>
  // root once sanitized (sanitizeSvg returns null on anything else).
  const head = buf.subarray(0, 512).toString('utf8').replace(/^﻿/, '').trimStart()
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'svg'
  return null
}

export function extensionFor(kind: ImageKind): string {
  return kind === 'ico' ? 'ico' : kind
}

export interface FileCheckResult {
  ok: boolean
  error?: string
  kind?: ImageKind
}

/** Full upload gate: size, real type, and (for SVG) successful sanitization. */
export function validateLogoUpload(buf: Buffer, declaredMimeType: string): FileCheckResult {
  if (buf.length === 0) return { ok: false, error: 'Empty file' }
  if (buf.length > MAX_LOGO_BYTES) return { ok: false, error: 'File exceeds the 2MB limit' }
  const kind = sniffImageType(buf)
  if (!kind) return { ok: false, error: 'Unrecognized file type — only PNG, WebP, SVG or ICO are accepted' }
  // Declared MIME must at least agree with the sniffed family — catches a
  // mislabeled upload even though the signature check is the real gate.
  const expectedMime: Record<ImageKind, string[]> = {
    png: ['image/png'],
    webp: ['image/webp'],
    ico: ['image/x-icon', 'image/vnd.microsoft.icon'],
    svg: ['image/svg+xml'],
  }
  if (declaredMimeType && !expectedMime[kind].includes(declaredMimeType)) {
    return { ok: false, error: `Declared type "${declaredMimeType}" does not match the file's real content (detected ${kind.toUpperCase()})` }
  }
  if (kind === 'svg') {
    const sanitized = sanitizeSvg(buf.toString('utf8'))
    if (!sanitized) return { ok: false, error: 'SVG failed sanitization — it may contain scripts or unsafe content' }
  }
  return { ok: true, kind }
}

/**
 * A minimal allowlist SVG sanitizer. Strips everything that can execute code
 * or reach outside the file: <script>, <foreignObject>, event-handler
 * attributes (onload, onclick, …), javascript:/data:text/html URIs, <style>
 * blocks with url(), and any <!DOCTYPE/<!ENTITY> (XXE / entity-expansion
 * vectors). Returns null if the result doesn't parse as a single <svg> root
 * — a good-faith "is this actually a plain SVG" check without a full XML
 * parser dependency.
 */
export function sanitizeSvg(raw: string): string | null {
  let s = raw.replace(/^﻿/, '')

  // No DOCTYPE/ENTITY at all — XXE and billion-laughs both start here.
  if (/<!DOCTYPE|<!ENTITY/i.test(s)) return null

  // Strip comments, <script>…</script>, <foreignObject>…</foreignObject>.
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, '')
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')

  // Strip every on* event-handler attribute (onload="…", onclick='…', …).
  s = s.replace(/\son\w+\s*=\s*"(?:[^"\\]|\\.)*"/gi, '')
  s = s.replace(/\son\w+\s*=\s*'(?:[^'\\]|\\.)*'/gi, '')

  // Strip href/xlink:href pointing at javascript:/data:text|application, and
  // any <style> block (which can carry `url(javascript:…)` / `@import`).
  s = s.replace(/\s(?:xlink:)?href\s*=\s*"(?:\s*javascript:|\s*data:(?:text|application))[^"]*"/gi, '')
  s = s.replace(/\s(?:xlink:)?href\s*=\s*'(?:\s*javascript:|\s*data:(?:text|application))[^']*'/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style\s*>/gi, '')

  const trimmed = s.trim()
  if (!/^(<\?xml[^>]*\?>\s*)?<svg[\s>][\s\S]*<\/svg>\s*$/i.test(trimmed)) return null
  // Nothing executable should remain — a defense-in-depth re-check.
  if (/<script|on\w+\s*=|javascript:/i.test(trimmed)) return null
  return trimmed
}

export { MAX_LOGO_BYTES }
