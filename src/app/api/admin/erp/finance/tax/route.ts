import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { listTaxProfiles, saveTaxProfile, deleteTaxProfile, computeProfile } from '@/lib/erp/taxData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — tax profiles (+ ?preview=<base>&profile=<id> live compute via the engine).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
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
const body = z.discriminatedUnion('action', [save, del])

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('manage_settings')
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
    const id = await saveTaxProfile(d, auth.user.id)
    await logAction(auth.user, 'erp.tax.profile.save', 'tax_profiles', id, null, { code: d.code, category: d.category }, ip)
    return NextResponse.json({ id })
  } catch (e) { return apiError(e, 'Failed to save tax profile') }
}
