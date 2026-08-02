import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requirePermission, readJson, badRequest } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import {
  generateDocumentNumber, previewDocumentNumber, validateDocumentNumber,
  reserveNumber, releaseReservedNumber, resetCounter,
} from '@/lib/numbering/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const scope = z.object({
  company: z.string().max(40).optional(),
  branch: z.string().max(40).optional(),
  warehouse: z.string().max(40).optional(),
  department: z.string().max(40).optional(),
}).optional()
const context = z.object({
  company: z.string().max(40).optional(), branch: z.string().max(40).optional(),
  warehouse: z.string().max(40).optional(), department: z.string().max(40).optional(),
  project: z.string().max(40).optional(), customField: z.string().max(40).optional(),
  random: z.string().max(40).optional(),
}).optional()

const schema = z.object({
  action: z.enum(['generate', 'preview', 'validate', 'reserve', 'release', 'reset']),
  docType: z.string().min(1).max(60),
  number: z.string().max(120).optional(),
  scope, context,
  scopeKey: z.string().max(200).optional(),
  periodKey: z.string().max(60).optional(),
})

// POST — the reusable numbering service surface. `generate`/`reserve` mutate a
// counter (RBAC edit); `preview`/`validate` are read-only.
export async function POST(req: NextRequest) {
  const parsed0 = await readJson(req, schema)
  if ('error' in parsed0) return parsed0.error
  const d = parsed0.data
  // Granular permissions mapped onto RBAC roles: resetting a counter is
  // destructive → administrator only (manage_settings); generate/reserve/release
  // are edit-level; preview/validate are read-only.
  const required = d.action === 'reset'
    ? 'manage_settings' as const
    : (d.action === 'generate' || d.action === 'reserve' || d.action === 'release') ? 'edit' as const : undefined
  const auth = await requirePermission('system.numbering', 'write', required)
  if ('error' in auth) return auth.error
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  try {
    switch (d.action) {
      case 'preview':
        return NextResponse.json({ number: await previewDocumentNumber(d.docType, { scope: d.scope, context: d.context }) })
      case 'validate': {
        if (!d.number) return badRequest('number required')
        return NextResponse.json(await validateDocumentNumber(d.docType, d.number))
      }
      case 'generate': {
        const g = await generateDocumentNumber({ docType: d.docType, scope: d.scope, context: d.context, module: 'admin', source: 'admin', userId: auth.user.id, ip })
        await logAction(auth.user, 'generate', 'numbering', d.docType, null, { number: g.number })
        return NextResponse.json(g)
      }
      case 'reserve': {
        const g = await reserveNumber({ docType: d.docType, scope: d.scope, context: d.context, module: 'admin', source: 'admin', userId: auth.user.id, ip })
        await logAction(auth.user, 'reserve', 'numbering', d.docType, null, { number: g.number })
        return NextResponse.json(g)
      }
      case 'release': {
        if (!d.number) return badRequest('number required')
        const ok = await releaseReservedNumber(d.docType, d.number)
        await logAction(auth.user, 'release', 'numbering', d.docType, null, { number: d.number })
        return NextResponse.json({ ok })
      }
      case 'reset': {
        const n = await resetCounter(d.docType, d.scopeKey, d.periodKey)
        await logAction(auth.user, 'reset', 'numbering_counter', d.docType, null, { removed: n })
        return NextResponse.json({ ok: true, removed: n })
      }
    }
  } catch (e) { return apiError(e, 'Numbering operation failed') }
}
