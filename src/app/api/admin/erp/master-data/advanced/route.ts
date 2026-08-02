import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { categoryTree, createCategory, updateCategory, moveCategory, mergeCategory, archiveCategory, migrateLegacyCategories } from '@/lib/masterdata/categoryData'
import { productSuppliers, addProductSupplier, setPrimary, removeProductSupplier } from '@/lib/masterdata/supplierData'
import { entityHistory, restoreProductVersion } from '@/lib/masterdata/versionData'
import { qualityDimensions, generateIssues, listIssues, updateIssue } from '@/lib/masterdata/masterDataData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — Master-Data Advanced (Phase 26.17): ?module=categories|suppliers|versions|dimensions|issues
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.master-data', 'read')
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  const mod = sp.get('module')
  try {
    if (mod === 'categories') return NextResponse.json(await categoryTree())
    if (mod === 'suppliers') {
      const pid = Number(sp.get('productId'))
      if (!pid) return badRequest('productId required')
      return NextResponse.json(await productSuppliers(pid))
    }
    if (mod === 'versions') {
      const et = sp.get('entityType') ?? ''
      const eid = Number(sp.get('entityId'))
      if (!et || !eid) return badRequest('entityType and entityId required')
      return NextResponse.json({ history: await entityHistory(et, eid) })
    }
    if (mod === 'dimensions') return NextResponse.json({ domains: await qualityDimensions() })
    if (mod === 'issues') return NextResponse.json({ issues: await listIssues(sp.get('status') ?? 'open') })
    return badRequest('Unknown module')
  } catch (e) { return apiError(e, 'Failed to load') }
}

const isAdmin = (role: string) => ['administrator', 'super_admin'].includes(role)

const schema = z.object({
  module: z.enum(['categories', 'suppliers', 'versions', 'issues']),
  action: z.string().min(1).max(40),
  payload: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.master-data', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const { module: mod, action } = parsed.data
  const p = parsed.data.payload as Record<string, never>
  const ip = clientIp(req)
  try {
    // ── Categories (M1) ──
    if (mod === 'categories') {
      if (action === 'create') { const r = await createCategory({ code: String(p.code), nameEn: String(p.nameEn), nameFa: p.nameFa, parentId: p.parentId ?? null, description: p.description, sortOrder: p.sortOrder }, auth.user.id); await logAction(auth.user, 'md.category.create', 'erp_category', r.id, null, p, ip); return NextResponse.json(r) }
      if (action === 'update') { await updateCategory(Number(p.id), p); await logAction(auth.user, 'md.category.update', 'erp_category', Number(p.id), null, p, ip); return NextResponse.json({ ok: true }) }
      if (action === 'move') { await moveCategory(Number(p.id), p.parentId ?? null); await logAction(auth.user, 'md.category.move', 'erp_category', Number(p.id), null, { parentId: p.parentId ?? null }, ip); return NextResponse.json({ ok: true }) }
      if (action === 'merge') { if (!isAdmin(auth.user.role)) return badRequest('Merge requires an administrator'); const r = await mergeCategory(Number(p.fromId), Number(p.toId)); await logAction(auth.user, 'md.category.merge', 'erp_category', Number(p.fromId), { toId: p.toId }, r, ip); return NextResponse.json({ ok: true, ...r }) }
      if (action === 'archive') { await archiveCategory(Number(p.id)); await logAction(auth.user, 'md.category.archive', 'erp_category', Number(p.id), null, null, ip); return NextResponse.json({ ok: true }) }
      if (action === 'migrate') { if (!isAdmin(auth.user.role)) return badRequest('Migration requires an administrator'); const r = await migrateLegacyCategories(auth.user.id); await logAction(auth.user, 'md.category.migrate', 'erp_category', 0, null, r, ip); return NextResponse.json({ ok: true, ...r }) }
    }
    // ── Alternative suppliers (M2) ──
    if (mod === 'suppliers') {
      if (action === 'add') { const r = await addProductSupplier({ productId: Number(p.productId), supplierId: Number(p.supplierId), supplierCode: p.supplierCode, purchasePrice: Number(p.purchasePrice ?? 0), currency: p.currency, leadTimeDays: Number(p.leadTimeDays ?? 0), minimumOrderQty: Number(p.minimumOrderQty ?? 0), qualityScore: Number(p.qualityScore ?? 0), deliveryScore: Number(p.deliveryScore ?? 0), isPrimary: !!p.isPrimary }); await logAction(auth.user, 'md.product_supplier.add', 'inv_product', Number(p.productId), null, p, ip); return NextResponse.json(r) }
      if (action === 'setPrimary') { await setPrimary(Number(p.productId), Number(p.supplierId)); await logAction(auth.user, 'md.product_supplier.primary', 'inv_product', Number(p.productId), null, { supplierId: p.supplierId }, ip); return NextResponse.json({ ok: true }) }
      if (action === 'remove') { await removeProductSupplier(Number(p.id)); await logAction(auth.user, 'md.product_supplier.remove', 'inv_product_supplier', Number(p.id), null, null, ip); return NextResponse.json({ ok: true }) }
    }
    // ── Versioning (M3) ──
    if (mod === 'versions') {
      if (action === 'restore') { if (!isAdmin(auth.user.role)) return badRequest('Restore requires an administrator'); const r = await restoreProductVersion(Number(p.historyId), auth.user.id); await logAction(auth.user, 'md.version.restore', 'inv_product', r.restoredTo, { historyId: p.historyId }, r, ip); return NextResponse.json({ ok: true, ...r }) }
    }
    // ── Steward issues (M5) ──
    if (mod === 'issues') {
      if (action === 'generate') { const r = await generateIssues(auth.user.id); await logAction(auth.user, 'md.issues.generate', 'master_data_issue', 0, null, r, ip); return NextResponse.json({ ok: true, ...r }) }
      if (['assign', 'resolve', 'ignore'].includes(action)) { await updateIssue(Number(p.id), action as 'assign' | 'resolve' | 'ignore', p.value); await logAction(auth.user, `md.issue.${action}`, 'master_data_issue', Number(p.id), null, { value: p.value }, ip); return NextResponse.json({ ok: true }) }
    }
    return badRequest('Unknown action')
  } catch (e) { return apiError(e, 'Operation failed') }
}
