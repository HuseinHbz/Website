import { NextResponse } from 'next/server'
import { requireAdmin, apiError } from '@/lib/api/respond'
import { chequeDashboard } from '@/lib/treasury/analyticsData'
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs'
export async function GET() { const auth = await requireAdmin(); if ('error' in auth) return auth.error; try { return NextResponse.json(await chequeDashboard()) } catch (e) { return apiError(e, 'Cheques failed') } }
