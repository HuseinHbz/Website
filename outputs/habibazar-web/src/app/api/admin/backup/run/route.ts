import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { backupEngine } from '@/lib/backup/engine'

// Manual backup trigger from the Admin Panel. Kicks the internal BackupEngine in
// the background (non-blocking) and returns immediately; progress + result stream
// into Logs & Monitoring and appear in the backup catalog.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  try {
    const auth = await requireAdmin('manage_settings')
    if ('error' in auth) return auth.error
    if (backupEngine.isRunning) {
      return NextResponse.json({ started: false, reason: 'a backup is already running' }, { status: 409 })
    }
    // Fire-and-forget: do not block the request on the backup completing.
    void backupEngine.run('manual')
    return NextResponse.json({ started: true }, { status: 202 })
  } catch (e: unknown) {
    return apiError(e)
  }
}
