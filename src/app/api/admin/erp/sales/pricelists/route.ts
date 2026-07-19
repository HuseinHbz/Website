import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { listPriceLists, priceListItems, savePriceList, setPriceListItem, deletePriceList } from '@/lib/erp/priceListData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — price lists, or one list's items (?items=<id>).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const items = Number(req.nextUrl.searchParams.get('items'))
    if (items) return NextResponse.json({ items: await priceListItems(items) })
    return NextResponse.json({ priceLists: await listPriceLists() })
  } catch (e) { return apiError(e, 'Failed to load price lists') }
}

const save = z.object({ action: z.literal('save'), id: z.number().int().optional(), code: z.string().min(1).max(30), nameEn: z.string().min(1).max(120), nameFa: z.string().min(1).max(120), currency: z.enum(['IRR', 'IRT', 'USD', 'EUR']).optional(), active: z.boolean().default(true) })
const setItem = z.object({ action: z.literal('setItem'), priceListId: z.number().int(), productId: z.number().int(), unitPrice: z.number().min(0).nullable() })
const del = z.object({ action: z.literal('delete'), id: z.number().int() })
const body = z.discriminatedUnion('action', [save, setItem, del])

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const ip = clientIp(req)
  try {
    if (d.action === 'save') { const id = await savePriceList(d, auth.user.id); await logAction(auth.user, 'erp.pricelist.save', 'price_lists', id, null, { code: d.code }, ip); return NextResponse.json({ id }) }
    if (d.action === 'setItem') { await setPriceListItem(d.priceListId, d.productId, d.unitPrice); await logAction(auth.user, 'erp.pricelist.item', 'price_lists', d.priceListId, null, { productId: d.productId }, ip); return NextResponse.json({ ok: true }) }
    await deletePriceList(d.id); await logAction(auth.user, 'erp.pricelist.delete', 'price_lists', d.id, null, null, ip); return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to update price list') }
}
