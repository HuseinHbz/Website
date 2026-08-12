/**
 * Media upload validation — magic-byte sniffing (never trusts the client's
 * declared MIME type/extension) + environment-configurable size limits, for
 * the Hero media categories (background video, animation video/SVG, poster
 * image). Reuses the SVG sanitizer already written for Brand & Identity
 * Settings (`lib/branding/fileValidation.ts`) rather than duplicating it.
 */
import { sanitizeSvg } from '@/lib/branding/fileValidation'
import { MEDIA_LIMITS_MB as SHARED_LIMITS_MB } from '@/lib/media/limits'

export type MediaKind = 'video' | 'webm-alpha' | 'image' | 'svg' | 'lottie'
export type MediaCategory = 'hero-background-video' | 'hero-animation-video' | 'hero-poster' | 'hero-animation-vector' | 'hero-animation-lottie'

/** Category → limit, re-keyed from the single shared source
 *  (src/lib/media/limits.ts) so this table can never drift from the
 *  numbers everything else (the legacy upload path, the middleware body
 *  cap, the diagnostics script) is checked against. */
export const MEDIA_LIMITS_MB = {
  'hero-background-video': SHARED_LIMITS_MB.backgroundVideo,
  'hero-animation-video': SHARED_LIMITS_MB.animationVideo,
  'hero-poster': SHARED_LIMITS_MB.image,
  'hero-animation-vector': SHARED_LIMITS_MB.vector,
  'hero-animation-lottie': SHARED_LIMITS_MB.vector,
} as const satisfies Record<MediaCategory, number>

const MP4_BOX_TYPES = ['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide']

function isMp4(buf: Buffer): boolean {
  // ISO-BMFF: a 4-byte big-endian box size followed by a 4-byte box type.
  // The first box is virtually always "ftyp", but be lenient and scan the
  // first couple of boxes since some encoders emit a leading "free"/"skip".
  if (buf.length < 12) return false
  for (let offset = 0; offset < Math.min(buf.length - 8, 64); ) {
    const size = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    if (MP4_BOX_TYPES.includes(type)) return true
    if (size < 8) break
    offset += size
  }
  return false
}

function isWebm(buf: Buffer): boolean {
  // EBML header: 0x1A45DFA3
  return buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3
}

function isPng(buf: Buffer): boolean {
  return buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
}
function isJpeg(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
}
function isWebpImage(buf: Buffer): boolean {
  return buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP'
}
function isSvgText(buf: Buffer): boolean {
  const head = buf.subarray(0, 512).toString('utf8').replace(/^﻿/, '').trimStart()
  return /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)
}

export interface MediaValidationResult {
  ok: boolean
  error?: string
  kind?: MediaKind
}

// Real production bug (26.34): the Video Background tab's own upload
// button text and file picker advertised "MP4/WebM/MOV/MKV" — but this
// table only accepted 'video' (MP4) for hero-background-video, so ANY
// real WebM upload there was rejected with a 415 no matter how valid the
// file was. Reproduced live before fixing (a genuine EBML-header WebM
// buffer → 415 MEDIA_UNSUPPORTED_FORMAT). Frontend and backend must
// accept the exact same set — 'webm-alpha' added here. MOV/MKV support
// was never real (no QuickTime/Matroska magic-byte detector exists in
// this file — a .mov/.mkv always fell through to `kind === null` →
// rejected), so instead of building that detection, the UI copy/accept
// attribute were corrected to just MP4/WebM (26.34 бند۳) — decisively
// NOT supported, not silently broken.
const ACCEPT_BY_CATEGORY: Record<MediaCategory, MediaKind[]> = {
  'hero-background-video': ['video', 'webm-alpha'],
  'hero-animation-video': ['video', 'webm-alpha'],
  'hero-poster': ['image'],
  'hero-animation-vector': ['svg'],
  'hero-animation-lottie': ['lottie'],
}

/** Sniffs the real content type from magic bytes and checks it against what
 *  the category accepts + the (env-configurable) size cap. Does NOT do
 *  Lottie JSON-schema validation (kept in the API route so a parse failure
 *  can report which field of the Lottie file was invalid). */
export function validateMediaUpload(buf: Buffer, category: MediaCategory, declaredMime: string): MediaValidationResult {
  const limitBytes = MEDIA_LIMITS_MB[category] * 1024 * 1024
  if (buf.length === 0) return { ok: false, error: 'Empty file' }
  if (buf.length > limitBytes) return { ok: false, error: `File exceeds the ${MEDIA_LIMITS_MB[category]}MB limit for this category` }

  let kind: MediaKind | null = null
  if (isMp4(buf)) kind = 'video'
  else if (isWebm(buf)) kind = 'webm-alpha' // WebM covers both plain and alpha-channel VP8/VP9 — alpha itself is a codec-level property, not a container signature
  else if (isPng(buf)) kind = 'image'
  else if (isJpeg(buf)) kind = 'image'
  else if (isWebpImage(buf)) kind = 'image'
  else if (isSvgText(buf)) kind = 'svg'
  else if (looksLikeJson(buf)) kind = 'lottie'

  if (!kind) return { ok: false, error: 'Unrecognized file — content does not match any accepted format' }

  const accepted = ACCEPT_BY_CATEGORY[category]
  if (!accepted.includes(kind)) {
    return { ok: false, error: `This category accepts ${accepted.join('/')}, but the file's real content is ${kind}` }
  }
  if (kind === 'svg') {
    if (!sanitizeSvg(buf.toString('utf8'))) return { ok: false, error: 'SVG failed sanitization — it may contain scripts or unsafe content' }
  }
  void declaredMime // real detection always wins; declared MIME is informational only here
  return { ok: true, kind }
}

function looksLikeJson(buf: Buffer): boolean {
  const head = buf.subarray(0, 64).toString('utf8').trimStart()
  return head.startsWith('{') || head.startsWith('[')
}

/** Minimal structural check for a Lottie export — required top-level keys,
 *  matching the spec's "Lottie فقط بعد از Schema Validation". Not a full
 *  JSON-Schema validator (no new dependency); checks the fields every real
 *  Lottie/Bodymovin export always has. */
export function validateLottieSchema(json: unknown): { ok: boolean; error?: string } {
  if (typeof json !== 'object' || json === null) return { ok: false, error: 'Not a JSON object' }
  const o = json as Record<string, unknown>
  const required = ['v', 'fr', 'ip', 'op', 'w', 'h', 'layers']
  for (const key of required) {
    if (!(key in o)) return { ok: false, error: `Missing required Lottie field "${key}"` }
  }
  if (!Array.isArray(o.layers)) return { ok: false, error: '"layers" must be an array' }
  if (typeof o.w !== 'number' || typeof o.h !== 'number') return { ok: false, error: '"w"/"h" must be numbers' }
  return { ok: true }
}
