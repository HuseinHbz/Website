import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** One guarded count → a missing table never breaks the badge row. */
async function count(sql: string): Promise<number> {
  try { const r = (await pgQuery<{ n: number }>(sql)) ; return Number(r[0]?.n ?? 0) } catch { return 0 }
}

// GET — real "pending / unread" counts per nav href, for sidebar notification
// badges. All counts come from live tables (new contact requests, new
// consultations, new CRM leads, failed backups, unresolved integration DLQ).
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const [contacts, consultations, leads, backupFail, dlq] = await Promise.all([
      count(`SELECT COUNT(*)::int n FROM contact_requests WHERE status='new'`),
      count(`SELECT COUNT(*)::int n FROM consultation_requests WHERE status='new'`),
      count(`SELECT COUNT(*)::int n FROM crm_leads WHERE status='new'`),
      count(`SELECT COUNT(*)::int n FROM backups WHERE status='failed'`),
      count(`SELECT COUNT(*)::int n FROM integration_dispatches WHERE status='dead' AND resolved=0`),
    ])
    const badges: Record<string, number> = {}
    if (contacts) badges['/admin/contacts'] = contacts
    if (consultations) badges['/admin/consultations'] = consultations
    if (leads) badges['/admin/crm'] = leads
    if (backupFail) badges['/admin/backup'] = backupFail
    if (dlq) badges['/admin/integration-hub'] = dlq
    return NextResponse.json({ badges })
  } catch (e) { return apiError(e, 'Failed to load nav badges') }
}
