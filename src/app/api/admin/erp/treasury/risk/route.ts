import { NextResponse } from 'next/server'
import { requireAdmin, apiError } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { currencyRisk, saveExposure } from '@/lib/treasury/analyticsData'
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs'
export async function GET() { const auth = await requireAdmin(); if ('error' in auth) return auth.error; try { return NextResponse.json(await currencyRisk()) } catch (e) { return apiError(e, 'Risk failed') } }
export async function POST() { const auth = await requireAdmin('edit'); if ('error' in auth) return auth.error; try { const r = await saveExposure(); await logAction(auth.user, 'treasury.exposure.save', 'currency_exposures', '', null, r); return NextResponse.json(r) } catch (e) { return apiError(e, 'Exposure save failed') } }
