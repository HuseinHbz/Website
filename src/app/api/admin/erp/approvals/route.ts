import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission, requireOp } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { DOC_TYPES } from '@/lib/approval/matrix'
import {
  createApprovalRequest, getApprovalRequest, actOnRequest, bulkApprove,
  addComment, inbox, approvalAnalytics, scanEscalations,
} from '@/lib/erp/approvalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET ?tab=pending|approved|rejected|delegated|expired | ?id= | ?view=analytics
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.approvals', 'read')
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  try {
    if (sp.get('view') === 'analytics') return NextResponse.json(await approvalAnalytics())
    const id = Number(sp.get('id'))
    if (id) { const r = await getApprovalRequest(id); return r ? NextResponse.json(r) : NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    const tab = (sp.get('tab') ?? 'pending') as 'pending' | 'approved' | 'rejected' | 'delegated' | 'expired'
    return NextResponse.json({ requests: await inbox(tab, auth.user.id) })
  } catch (e) { return apiError(e, 'Failed to load approvals') }
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), docType: z.enum(DOC_TYPES), refType: z.string().max(60).optional(), refId: z.number().int().positive().optional(), title: z.string().min(1).max(200), amount: z.number(), currency: z.string().max(8).optional(), department: z.string().max(120).optional(), costCenterId: z.number().int().positive().optional(), projectId: z.number().int().positive().optional(), context: z.record(z.string(), z.unknown()).optional() }),
  z.object({ action: z.literal('decide'), id: z.number().int().positive(), decision: z.enum(['approved', 'rejected', 'changes_requested']), comment: z.string().max(2000).optional() }),
  z.object({ action: z.literal('bulk'), ids: z.array(z.number().int().positive()).min(1).max(100) }),
  z.object({ action: z.literal('comment'), id: z.number().int().positive(), body: z.string().min(1).max(2000), internal: z.boolean().optional(), attachmentUrl: z.string().max(500).optional(), mentions: z.array(z.string().max(60)).max(20).optional() }),
  z.object({ action: z.literal('escalate') }),
])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.approvals', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const ip = clientIp(req)
  try {
    if (d.action === 'create') {
      const r = await createApprovalRequest(d, auth.user.id)
      await logAction(auth.user, 'approval.request', 'approval_requests', r.id, null, { docType: d.docType, amount: d.amount }, ip)
      return NextResponse.json(r)
    }
    if (d.action === 'decide') {
      { const opKey = d.decision === 'approved' ? 'erp.approvals:approve' : 'erp.approvals:reject'
        const deny = await requireOp(auth.user, opKey, 'edit'); if (deny) return deny }
      const r = await actOnRequest(d.id, auth.user, d.decision, d.comment, ip)
      await logAction(auth.user, `approval.${d.decision}`, 'approval_requests', d.id, null, { decision: d.decision }, ip)
      return NextResponse.json(r)
    }
    if (d.action === 'bulk') {
      const r = await bulkApprove(d.ids, auth.user, ip)
      await logAction(auth.user, 'approval.bulk', 'approval_requests', '', null, r, ip)
      return NextResponse.json(r)
    }
    if (d.action === 'comment') {
      const r = await addComment(d.id, auth.user.id, d.body, { internal: d.internal, attachmentUrl: d.attachmentUrl, mentions: d.mentions })
      await logAction(auth.user, 'approval.comment', 'approval_requests', d.id, null, null, ip)
      return NextResponse.json(r)
    }
    // escalate scan — administrator only.
    if (!['super_admin', 'administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    const r = await scanEscalations()
    await logAction(auth.user, 'approval.escalate.scan', 'approval_requests', '', null, r, ip)
    return NextResponse.json(r)
  } catch (e) { return apiError(e, 'Approval operation failed') }
}
