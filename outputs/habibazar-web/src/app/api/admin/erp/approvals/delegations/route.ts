import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { listDelegations, createDelegation, revokeDelegation } from '@/lib/erp/approvalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try { return NextResponse.json({ delegations: await listDelegations() }) } catch (e) { return apiError(e, 'Failed to load delegations') }
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), fromUserId: z.string().min(1).max(60), toUserId: z.string().min(1).max(60), startDate: z.string().max(10), endDate: z.string().max(10), docType: z.string().max(60).optional(), department: z.string().max(120).optional() }),
  z.object({ action: z.literal('revoke'), id: z.number().int().positive() }),
])

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    // Delegating another user's authority requires an administrator; a user may
    // only create a delegation FROM themselves.
    if (d.action === 'create') {
      if (d.fromUserId !== auth.user.id && !['super_admin', 'administrator'].includes(auth.user.role))
        return NextResponse.json({ error: 'You can only delegate your own approvals' }, { status: 403 })
      const r = await createDelegation(d, auth.user.id)
      await logAction(auth.user, 'approval.delegation.create', 'approval_delegations', r.id, null, { from: d.fromUserId, to: d.toUserId })
      return NextResponse.json(r)
    }
    await revokeDelegation(d.id); await logAction(auth.user, 'approval.delegation.revoke', 'approval_delegations', d.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Delegation operation failed') }
}
