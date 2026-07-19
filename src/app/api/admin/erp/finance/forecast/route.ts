import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { FORECAST_METHODS, FORECAST_METRICS } from '@/lib/erp/forecast'
import { runForecast, saveForecast, listForecasts } from '@/lib/erp/financialIntelligenceData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const metric = z.enum(FORECAST_METRICS)
const method = z.enum(FORECAST_METHODS)

// GET ?run=1&metric=&method=&horizon= | (default: saved forecasts)
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  try {
    if (sp.get('run')) {
      const m = metric.safeParse(sp.get('metric')); const me = method.safeParse(sp.get('method') ?? 'trend')
      if (!m.success || !me.success) return NextResponse.json({ error: 'Invalid metric/method' }, { status: 400 })
      const horizon = Math.min(12, Math.max(1, Number(sp.get('horizon')) || 3))
      return NextResponse.json(await runForecast(m.data, me.data, horizon))
    }
    return NextResponse.json({ forecasts: await listForecasts() })
  } catch (e) { return apiError(e, 'Forecast failed') }
}

const schema = z.object({ action: z.literal('save'), nameEn: z.string().min(1).max(120), nameFa: z.string().max(120).optional(), metric, method, horizon: z.number().int().min(1).max(12).default(3), currency: z.string().max(8).optional() })

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  try {
    const r = await saveForecast(parsed.data, auth.user.id)
    await logAction(auth.user, 'finance.forecast.save', 'erp_forecasts', r.id, null, { metric: parsed.data.metric, method: parsed.data.method })
    return NextResponse.json(r)
  } catch (e) { return apiError(e, 'Save forecast failed') }
}
