import { NextRequest } from 'next/server'
import { stat } from 'fs/promises'
import { createReadStream } from 'fs'
import { Readable } from 'stream'
import path from 'path'
import { parseRange } from '@/lib/media/range'

// Serve user-uploaded files from public/uploads at runtime. Next.js only serves
// public/ files that existed at build time, so freshly uploaded images would 404
// under `next start`. This handler streams them directly — works in dev and prod
// regardless of whether nginx is fronting /uploads/.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.bmp': 'image/bmp', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  // Missing until now — every video uploaded through the Hero media
  // categories (background/animation videos, `public/uploads/hero-videos`
  // and `hero-orbit`) is served through THIS route, not nginx (see the file
  // banner above), so it fell through to 'application/octet-stream'. Some
  // browsers refuse to `<video autoplay>` a source with a non-video
  // Content-Type — a real, live playback bug, not just a header nicety.
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska', '.json': 'application/json',
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params
  // Reject anything that isn't a plain filename segment (blocks path traversal).
  if (!parts?.length || parts.some((p) => !/^[a-zA-Z0-9._-]+$/.test(p) || p === '..')) {
    return new Response('Bad request', { status: 400 })
  }
  const file = path.join(UPLOADS_DIR, ...parts)
  if (!file.startsWith(UPLOADS_DIR + path.sep)) {
    return new Response('Forbidden', { status: 403 })
  }

  let size: number
  try {
    size = (await stat(file)).size
  } catch {
    return new Response('Not found', { status: 404 })
  }

  const ext = path.extname(file).toLowerCase()
  const contentType = MIME[ext] || 'application/octet-stream'
  const baseHeaders = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=604800',
    'Accept-Ranges': 'bytes',
  }

  // HTTP Range support — required for video scrubbing/seeking (the browser
  // sends Range requests to jump to a timestamp without downloading
  // everything before it) and is a hard requirement for Safari/iOS video
  // playback in general, not just a nicety. A plain 200-with-the-whole-file
  // response (the previous behavior) works for playback-from-the-start but
  // breaks seeking on any video large enough for the browser to bother
  // range-requesting.
  const range = parseRange(req.headers.get('range'), size)
  if (range) {
    const { start, end } = range
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
    return new Response(stream, {
      status: 206,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
      },
    })
  }

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream
  return new Response(stream, {
    headers: { ...baseHeaders, 'Content-Length': String(size) },
  })
}
