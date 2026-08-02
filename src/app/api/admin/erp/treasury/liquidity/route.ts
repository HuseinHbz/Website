import { NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { liquidity, saveForecast } from '@/lib/treasury/analyticsData'
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs'
export async function GET() { const auth = await requirePermission('erp.treasury', 'read'); if ('error' in auth) return auth.error; try { return NextResponse.json(await liquidity()) } catch (e) { return apiError(e, 'Liquidity failed') } }
export async function POST() { const auth = await requirePermission('erp.treasury', 'write', 'edit'); if ('error' in auth) return auth.error; try { const r = await saveForecast(auth.user.id); await logAction(auth.user, 'treasury.forecast.save', 'treasury_forecasts', r.id); return NextResponse.json(r) } catch (e) { return apiError(e, 'Forecast failed') } }
