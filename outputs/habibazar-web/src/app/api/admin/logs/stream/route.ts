import { requireAdmin, unauthorized } from '@/lib/api/respond'
import { logBus, type SystemLog } from '@/lib/logs/bus'

// Server-Sent Events endpoint — streams log entries live into the admin
// Logs & Monitoring console (no polling). Backfills the recent ring buffer on
// connect, then pushes every new entry until the client disconnects.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireAdmin('manage_settings')
  if ('error' in auth) return unauthorized()

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeat: NodeJS.Timeout | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: SystemLog) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`)) } catch { /* closed */ }
      }
      // Backfill recent history, then subscribe to live events.
      controller.enqueue(encoder.encode(`event: ready\ndata: {"ok":true}\n\n`))
      for (const e of logBus.recent(150)) send(e)
      unsubscribe = logBus.subscribe(send)
      // Keep the connection alive through proxies.
      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: ping\n\n`)) } catch { /* closed */ }
      }, 25_000)
      if (heartbeat.unref) heartbeat.unref()
    },
    cancel() {
      unsubscribe?.()
      if (heartbeat) clearInterval(heartbeat)
    },
  })

  req.signal.addEventListener('abort', () => {
    unsubscribe?.()
    if (heartbeat) clearInterval(heartbeat)
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
