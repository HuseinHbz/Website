import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { erpSettings, setErpSetting, SUPPORTED_CURRENCIES } from '@/lib/erp/settings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Global ERP configuration (currency defaults, formatting). */
export async function GET() {
  const auth = await requirePermission('system.settings', 'read')
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json({ ...(await erpSettings(true)), supportedCurrencies: SUPPORTED_CURRENCIES })
  } catch (e) { return apiError(e, 'Failed to load ERP settings') }
}

const schema = z.object({
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
  displayCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
  decimalPrecision: z.number().int().min(0).max(4).optional(),
  numberFormat: z.enum(['standard', 'compact']).optional(),
})

export async function PUT(req: NextRequest) {
  const auth = await requirePermission('system.settings', 'write', 'manage_settings')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.defaultCurrency) await setErpSetting('default_currency', d.defaultCurrency)
    if (d.displayCurrency) await setErpSetting('display_currency', d.displayCurrency)
    if (d.decimalPrecision != null) await setErpSetting('decimal_precision', String(d.decimalPrecision))
    if (d.numberFormat) await setErpSetting('number_format', d.numberFormat)
    await logAction(auth.user, 'erp.settings.update', 'erp_settings', '', d)
    return NextResponse.json(await erpSettings(true))
  } catch (e) { return apiError(e, 'Failed to save ERP settings') }
}
