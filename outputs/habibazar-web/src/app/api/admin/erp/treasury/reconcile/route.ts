import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { suggestMatches, confirmMatch } from '@/lib/treasury/bankOpsData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error
  const id = Number(req.nextUrl.searchParams.get('accountId')); if (!id) return NextResponse.json({ error: 'accountId required' }, { status: 400 })
  try { return NextResponse.json(await suggestMatches(id)) } catch (e) { return apiError(e, 'Reconcile failed') }
}
const schema = z.object({ lineId: z.number().int().positive(), erpRef: z.string().min(1).max(60), confidence: z.number(), status: z.enum(['matched','rejected']), reasons: z.array(z.string()).max(10).optional() })
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit'); if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema); if ('error' in parsed) return parsed.error
  const d = parsed.data
  try { await confirmMatch(d.lineId, d.erpRef, d.confidence, d.status, d.reasons ?? [], auth.user.id); await logAction(auth.user, `treasury.recon.${d.status}`, 'bank_matches', d.lineId, null, { erpRef: d.erpRef }); return NextResponse.json({ ok: true }) }
  catch (e) { return apiError(e, 'Match failed') }
}
