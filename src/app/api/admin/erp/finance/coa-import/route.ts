import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { listCoaTemplates, previewCoaImport, applyCoaImport } from '@/lib/erp/coaImportData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — ?view=templates (the 3 seeded statutory variants) or ?view=preview&key=<template>
// (a live diff: what importing that template would create vs skip). Reuses the
// same erp.finance:read permission every other Chart-of-Accounts endpoint uses.
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'read')
  if ('error' in auth) return auth.error
  try {
    const view = req.nextUrl.searchParams.get('view') ?? 'templates'
    if (view === 'templates') return NextResponse.json({ templates: await listCoaTemplates() })
    if (view === 'preview') {
      const key = req.nextUrl.searchParams.get('key') ?? ''
      if (!key) return badRequest('Missing template key')
      const { plan, summary } = await previewCoaImport(key)
      return NextResponse.json({ plan, summary })
    }
    return badRequest('Unknown view')
  } catch (e) { return apiError(e, 'Failed to load chart-of-accounts import data') }
}

const schema = z.object({ action: z.literal('apply'), templateKey: z.string().min(1).max(40) })

// POST — applies a template to the LIVE chart of accounts (additive-only:
// existing codes are skipped, never overwritten). Same write permission as
// every other Chart-of-Accounts mutation — no new RBAC operation.
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  try {
    const res = await applyCoaImport(parsed.data.templateKey, auth.user.id)
    await logAction(auth.user, 'gl.coa.import', 'gl_accounts', undefined,
      null, { templateKey: parsed.data.templateKey, created: res.created, skipped: res.skipped }, clientIp(req))
    return NextResponse.json(res)
  } catch (e) { return apiError(e, 'Failed to import the chart of accounts') }
}
