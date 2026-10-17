import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission, requireOp } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { listTaxProfiles, saveTaxProfile, deleteTaxProfile, computeProfile, listTaxRates, currentVatRate, confirmVatRate, VatRateNotConfirmedError } from '@/lib/erp/taxData'
import { runVatSettlement } from '@/lib/erp/vatSettlement'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — tax profiles (+ ?preview=<base>&profile=<id> live compute via the
// engine) · ?view=rate for the statutory VAT rate (ERPFIX-7, BUG-ERP-20) —
// returns { confirmed: false } rather than a guessed number when nothing has
// been confirmed yet, never a 500.
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'read')
  if ('error' in auth) return auth.error
  try {
    const view = req.nextUrl.searchParams.get('view')
    if (view === 'rate') {
      const rates = await listTaxRates('VAT')
      try {
        const cur = await currentVatRate(req.nextUrl.searchParams.get('asOf') ?? undefined)
        return NextResponse.json({ confirmed: true, rate: cur.rate, effectiveFrom: cur.effectiveFrom, history: rates })
      } catch (e) {
        if (e instanceof VatRateNotConfirmedError) return NextResponse.json({ confirmed: false, rate: null, history: rates })
        throw e
      }
    }
    const profiles = await listTaxProfiles()
    const base = Number(req.nextUrl.searchParams.get('preview'))
    const pid = Number(req.nextUrl.searchParams.get('profile'))
    if (base && pid) {
      const p = profiles.find(x => x.id === pid)
      if (p) return NextResponse.json({ profiles, preview: computeProfile(p, base) })
    }
    return NextResponse.json({ profiles })
  } catch (e) { return apiError(e, 'Failed to load tax profiles') }
}

const save = z.object({
  action: z.literal('save'), id: z.number().int().optional(),
  code: z.string().min(1).max(20), nameEn: z.string().min(1).max(120), nameFa: z.string().min(1).max(120),
  category: z.enum(['standard', 'zero_rated', 'exempt', 'export', 'service']),
  vatRate: z.number().min(0).max(100), withholdingRate: z.number().min(0).max(100),
  exempt: z.boolean().default(false), active: z.boolean().default(true),
})
const del = z.object({ action: z.literal('delete'), id: z.number().int() })
const confirmRate = z.object({ action: z.literal('confirmRate'), rate: z.number().min(0).max(100), effectiveFrom: z.string().min(4) })
const settleVat = z.object({ action: z.literal('settleVat'), from: z.string().min(4), to: z.string().min(4), companyId: z.number().int().optional() })
const body = z.discriminatedUnion('action', [save, del, confirmRate, settleVat])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'write', 'manage_settings')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const ip = clientIp(req)
  try {
    if (d.action === 'delete') {
      await deleteTaxProfile(d.id)
      await logAction(auth.user, 'erp.tax.profile.delete', 'tax_profiles', d.id, null, null, ip)
      return NextResponse.json({ ok: true })
    }
    if (d.action === 'confirmRate') {
      // BUG-ERP-20: confirming a statutory VAT rate is its own sensitive op,
      // never implied by the module's general `write` grant (rule 17).
      const deny = await requireOp(auth.user, 'erp.finance:confirm_tax_rate', 'manage_settings')
      if (deny) return deny
      const id = await confirmVatRate(d.rate, d.effectiveFrom, auth.user.id)
      await logAction(auth.user, 'erp.tax.rate.confirm', 'tax_rates', id, null, { rate: d.rate, effectiveFrom: d.effectiveFrom }, ip)
      return NextResponse.json({ id })
    }
    if (d.action === 'settleVat') {
      const deny = await requireOp(auth.user, 'erp.finance:vat_settle', 'edit')
      if (deny) return deny
      const result = await runVatSettlement(d.from, d.to, d.companyId, auth.user.id)
      await logAction(auth.user, 'erp.tax.vat.settle', 'vat_settlements', result.entryId ?? 0, null, { from: d.from, to: d.to, netPayable: result.netPayable, alreadySettled: result.alreadySettled }, ip)
      return NextResponse.json(result)
    }
    const id = await saveTaxProfile(d, auth.user.id)
    await logAction(auth.user, 'erp.tax.profile.save', 'tax_profiles', id, null, { code: d.code, category: d.category }, ip)
    return NextResponse.json({ id })
  } catch (e) { return apiError(e, 'Failed to save tax profile') }
}
