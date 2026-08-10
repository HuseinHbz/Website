import { NextRequest, NextResponse } from 'next/server'
import { pgQuery } from '@/lib/db'
import { requireHrPortal } from '@/lib/hr/portalGuard'
import { myPayslipDetail, portalEmployee } from '@/lib/hr/portalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const money = (n: number) => Math.round(n).toLocaleString('fa-IR')

// GET — printable payslip HTML (own slip only; foreign/unapproved id → 404).
// Reuses the same company-letterhead pattern as the customer-portal invoice
// print route (26.24b stylesheet).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  const { id } = await params
  const slip = await myPayslipDetail(auth.identity.employeeId, Number(id))
  if (!slip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const emp = await portalEmployee(auth.identity.employeeId)

  const s = new Map((await pgQuery<{ key: string; value: string }>(
    `SELECT key, value FROM erp_settings WHERE key IN ('company_name','company_reg_no')`).catch(() => [])).map(r => [r.key, r.value]))
  const earnings = slip.lines.filter(l => l.lineType === 'earning')
  const deductions = slip.lines.filter(l => l.lineType === 'deduction')
  const row = (l: { labelFa: string; amount: number }) => `<tr><td>${esc(l.labelFa)}</td><td class="n">${money(l.amount)}</td></tr>`

  const html = `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>فیش حقوقی</title>
<style>body{font-family:Vazirmatn,Tahoma,sans-serif;color:#111;max-width:700px;margin:24px auto;padding:0 16px}
h1{font-size:18px;border-bottom:2px solid #111;padding-bottom:8px}.meta{font-size:12px;color:#444;margin-bottom:12px}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}th,td{border:1px solid #999;padding:6px 8px;text-align:right}
.n{text-align:left;font-variant-numeric:tabular-nums}tfoot td{font-weight:bold}
.cols{display:flex;gap:16px}.cols>div{flex:1}
@media print{@page{size:A4;margin:14mm}button{display:none}}
button{margin-top:16px;padding:8px 16px}</style></head><body>
<h1>${esc(s.get('company_name') || 'HBZ')}</h1>
<div class="meta">${s.get('company_reg_no') ? 'ثبت: ' + esc(s.get('company_reg_no')) : ''}</div>
<h2 style="font-size:15px">فیش حقوقی — ${esc(slip.jalaliYear)}/${String(slip.jalaliMonth).padStart(2, '0')}</h2>
<div class="meta">${esc(emp?.firstName)} ${esc(emp?.lastName)} — کد پرسنلی ${esc(emp?.employeeCode)}</div>
<div class="cols">
<div><table><thead><tr><th>دریافتی</th><th class="n">مبلغ (ریال)</th></tr></thead>
<tbody>${earnings.map(row).join('')}</tbody></table></div>
<div><table><thead><tr><th>کسورات</th><th class="n">مبلغ (ریال)</th></tr></thead>
<tbody>${deductions.map(row).join('')}</tbody></table></div>
</div>
<table><tfoot>
<tr><td>جمع مزایا</td><td class="n">${money(slip.gross)}</td></tr>
<tr><td>خالص پرداختی</td><td class="n">${money(slip.net)}</td></tr>
</tfoot></table>
<button onclick="window.print()">چاپ / Print</button></body></html>`
  return new NextResponse(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
}
