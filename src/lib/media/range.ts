/** "bytes=START-END" (either side optional) per RFC 7233 — only the single-
 *  range form, which is all any real browser sends for `<video>` seeking.
 *  Pulled out of the uploads route.ts into its own module because Next.js
 *  route files only allow specific named exports (GET/POST/etc. + a few
 *  config fields) — an arbitrary exported helper fails the build ("is not
 *  a valid Route export field"), so this can't live there and still be
 *  unit-testable. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header?.startsWith('bytes=')) return null
  const [startStr, endStr] = header.slice(6).split('-')
  let start = startStr ? parseInt(startStr, 10) : NaN
  let end = endStr ? parseInt(endStr, 10) : size - 1
  if (Number.isNaN(start)) {
    // "bytes=-500" — the last 500 bytes.
    if (Number.isNaN(end)) return null
    start = Math.max(0, size - end)
    end = size - 1
  }
  if (Number.isNaN(end) || end >= size) end = size - 1
  if (start < 0 || start > end || start >= size) return null
  return { start, end }
}
