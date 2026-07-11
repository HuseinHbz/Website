import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { listCurrencies, latestRates, rateHistory, setRate, rialRateFor } from '@/lib/erp/currencyData'
import { convert } from '@/lib/erp/currency'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — currencies + latest rates (+ ?history=CODE, + ?convert=amount&from&to)
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const sp = req.nextUrl.searchParams
    if (sp.get('history')) return NextResponse.json({ history: await rateHistory(sp.get('history')!.toUpperCase()) })
    const rates = await latestRates()
    if (sp.get('convert')) {
      const amount = Number(sp.get('convert'))
      const from = (sp.get('from') || 'IRR').toUpperCase(); const to = (sp.get('to') || 'IRR').toUpperCase()
      return NextResponse.json({ result: convert(amount, from, to, rates), rates })
    }
    return NextResponse.json({ currencies: await listCurrencies(), rates })
  } catch (e) { return apiError(e, 'Failed to load currencies') }
}

const setRateSchema = z.object({
  action: z.literal('setRate'),
  code: z.string().min(2).max(4),
  rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  baseRate: z.number().positive(),
})
const body = z.discriminatedUnion('action', [setRateSchema])

// POST — set/override an exchange rate (Rial value of one unit). RBAC + audit.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const prev = await rialRateFor(d.code.toUpperCase())
    await setRate(d.code.toUpperCase(), d.rateDate, d.baseRate, auth.user.id)
    await logAction(auth.user, 'erp.currency.setRate', 'erp_exchange_rates', d.code, { rateDate: d.rateDate, oldRate: prev, newRate: d.baseRate })
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to set rate') }
}
