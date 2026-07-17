import { NextRequest, NextResponse } from 'next/server'
import { pgQuery } from '@/lib/db'
import { requirePortal } from '@/lib/portal/guard'
import { portalInvoice } from '@/lib/portal/portalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

// GET — printable invoice HTML (own invoice only; foreign id → 404). Company
// letterhead from erp_settings; self-contained @media print stylesheet (بند ۲.۴).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  const { id } = await params
  const inv = await portalInvoice(auth.identity.customerId, Number(id))
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const s = new Map((await pgQuery<{ key: string; value: string }>(`SELECT key, value FROM erp_settings WHERE key IN ('company_name','company_reg_no','company_economic_code')`).catch(() => [])).map(r => [r.key, r.value]))
  const d = inv.doc as Record<string, unknown>
  const lines = (inv.lines as Record<string, unknown>[]).map(l => `<tr><td>${esc(l.description)}</td><td class="n">${esc(l.qty)}</td><td class="n">${Number(l.unitPrice).toLocaleString()}</td><td class="n">${Number(l.lineTotal).toLocaleString()}</td></tr>`).join('')
  const html = `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>${esc(d.docNo)}</title>
<style>body{font-family:Vazirmatn,Tahoma,sans-serif;color:#111;max-width:800px;margin:24px auto;padding:0 16px}
h1{font-size:18px;border-bottom:2px solid #111;padding-bottom:8px}.meta{font-size:12px;color:#444}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}th,td{border:1px solid #999;padding:6px 8px;text-align:right}
.n{text-align:left;font-variant-numeric:tabular-nums}tfoot td{font-weight:bold}
@media print{@page{size:A4;margin:14mm}button{display:none}}
button{margin-top:16px;padding:8px 16px}</style></head><body>
<h1>${esc(s.get('company_name') || 'HBZ')}</h1>
<div class="meta">${s.get('company_reg_no') ? 'ثبت: ' + esc(s.get('company_reg_no')) + ' · ' : ''}${s.get('company_economic_code') ? 'کد اقتصادی: ' + esc(s.get('company_economic_code')) : ''}</div>
<h2 style="font-size:15px">فاکتور ${esc(d.docNo)}</h2>
<div class="meta">تاریخ: ${esc(d.date)}${d.dueDate ? ' · سررسید: ' + esc(d.dueDate) : ''} · وضعیت: ${esc(d.status)}</div>
<table><thead><tr><th>شرح</th><th class="n">تعداد</th><th class="n">فی</th><th class="n">جمع</th></tr></thead>
<tbody>${lines}</tbody>
<tfoot><tr><td colspan="3">جمع کل</td><td class="n">${Number(d.total).toLocaleString()}</td></tr>
<tr><td colspan="3">پرداخت‌شده</td><td class="n">${inv.paid.toLocaleString()}</td></tr>
<tr><td colspan="3">مانده</td><td class="n">${inv.outstanding.toLocaleString()}</td></tr></tfoot></table>
<button onclick="window.print()">چاپ / Print</button></body></html>`
  return new NextResponse(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
}
