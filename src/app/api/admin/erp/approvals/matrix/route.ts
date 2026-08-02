import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { DOC_TYPES } from '@/lib/approval/matrix'
import { listMatrixRows, upsertMatrixRule, deleteMatrixRule } from '@/lib/erp/approvalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requirePermission('erp.approvals', 'read')
  if ('error' in auth) return auth.error
  try { return NextResponse.json({ rules: await listMatrixRows() }) } catch (e) { return apiError(e, 'Failed to load matrix') }
}

const approver = z.object({ type: z.enum(['role', 'user', 'department', 'cost_center', 'project']), ref: z.string().max(80), label: z.string().max(80).optional() })
const level = z.object({ level: z.number().int().min(1), mode: z.enum(['all', 'any', 'min']), minCount: z.number().int().min(1).optional(), approvers: z.array(approver).min(1).max(20) })
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), id: z.number().int().positive().optional(), docType: z.enum(DOC_TYPES), nameEn: z.string().max(120).optional(), nameFa: z.string().max(120).optional(), minAmount: z.number(), maxAmount: z.number().nullable().optional(), condition: z.unknown().optional(), levels: z.array(level).min(1).max(10), priority: z.number().int().optional() }),
  z.object({ action: z.literal('delete'), id: z.number().int().positive() }),
])

export async function POST(req: NextRequest) {
  // Matrix defines who can approve — administrator only.
  const auth = await requirePermission('erp.approvals', 'write', 'manage_settings')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'delete') { await deleteMatrixRule(d.id); await logAction(auth.user, 'approval.matrix.delete', 'approval_matrix', d.id); return NextResponse.json({ ok: true }) }
    const r = await upsertMatrixRule(d, auth.user.id)
    await logAction(auth.user, 'approval.matrix.save', 'approval_matrix', r.id, null, { docType: d.docType })
    return NextResponse.json(r)
  } catch (e) { return apiError(e, 'Matrix operation failed') }
}
