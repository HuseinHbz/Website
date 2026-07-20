import { NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { currentCashPosition, saveCashSnapshot } from '@/lib/treasury/analyticsData'
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs'
export async function GET() { const auth = await requirePermission('erp.treasury', 'read'); if ('error' in auth) return auth.error; try { return NextResponse.json(await currentCashPosition()) } catch (e) { return apiError(e, 'Cash failed') } }
export async function POST() { const auth = await requirePermission('erp.treasury', 'write', 'edit'); if ('error' in auth) return auth.error; try { const r = await saveCashSnapshot(auth.user.id); await logAction(auth.user, 'treasury.cash.snapshot', 'cash_positions', r.id); return NextResponse.json(r) } catch (e) { return apiError(e, 'Snapshot failed') } }
