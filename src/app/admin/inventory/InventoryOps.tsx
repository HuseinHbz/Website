'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Badge, Input } from '@/components/admin/ui'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import { code39Svg, ean13Svg } from '@/lib/erp/barcode'
import { fmtMoney } from '@/lib/format'

const L = (fa: boolean, en: string, faT: string) => (fa ? faT : en)
type Toast = (m: string, k?: 'success' | 'error') => void
const OPS = '/api/admin/erp/inventory/ops'
const post = (action: string, payload: Record<string, unknown> = {}) =>
  fetch(OPS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) })

interface WarehouseOpt { id: number; code: string; nameEn: string }
function useWarehouses(): WarehouseOpt[] {
  const [list, setList] = useState<WarehouseOpt[]>([])
  useEffect(() => { fetch('/api/admin/erp/inventory/warehouses').then(r => r.json()).then(d => setList((d.warehouses ?? []).map((w: { id: number; code: string; nameEn: string }) => ({ id: w.id, code: w.code, nameEn: w.nameEn })))).catch(() => {}) }, [])
  return list
}
interface ProductOpt { id: number; sku: string; nameEn: string; nameFa: string | null; barcode?: string | null }
function ProductPick({ fa, onPick }: { fa: boolean; onPick: (p: ProductOpt) => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<ProductOpt[]>([])
  useEffect(() => {
    if (!q.trim()) { setRows([]); return }
    const t = setTimeout(() => fetch(`/api/admin/erp/inventory/products?picker=1&q=${encodeURIComponent(q)}`).then(r => r.json()).then(d => setRows(d.products ?? [])).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="relative">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={L(fa, 'Search product…', 'جستجوی کالا…')} className="form-input !py-1.5 text-xs w-full" />
      {rows.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-subtle bg-surface-2 shadow-lg">
          {rows.map(p => <button key={p.id} type="button" onClick={() => { onPick(p); setQ(''); setRows([]) }} className="block w-full text-start px-3 py-1.5 text-xs text-text-secondary hover:bg-surface"><span className="font-mono text-text-tertiary">{p.sku}</span> · {fa ? (p.nameFa || p.nameEn) : p.nameEn}</button>)}
        </div>
      )}
    </div>
  )
}

// ── Intelligence (PARTS 3/8/11) ──────────────────────────────────────────────
interface IntelRow { id: number; sku: string; name: string; onHand: number; value: number; abc: string; xyz: string; movement: string; turnover: number; belowReorder: boolean; aging: string; eoq: number }
interface IntelPayload { kpis: { products: number; totalValue: number; aCount: number; deadCount: number; fastCount: number; belowReorder: number; nearExpiryCount: number; avgTurnover: number }; rows: IntelRow[]; reorder: { id: number; sku: string; name: string; onHand: number; reorderPoint: number; suggestedQty: number }[]; nearExpiry: { id: number; sku: string; batchNo: string; expiryDate: string | null; qtyRemaining: number }[] }
export function IntelligenceTab({ fa }: { fa: boolean }) {
  const [d, setD] = useState<IntelPayload | null>(null)
  useEffect(() => { fetch(`${OPS}?view=intelligence`).then(r => r.json()).then(setD).catch(() => {}) }, [])
  if (!d) return <Card><p className="text-xs text-text-tertiary">{L(fa, 'Analyzing stock…', 'در حال تحلیل موجودی…')}</p></Card>
  const cell = (label: string, value: string | number, cls = 'text-text-primary') => (
    <Card><p className="text-2xs text-text-tertiary mb-1">{label}</p><p className={`text-xl font-bold ${cls}`}>{value}</p></Card>
  )
  const mv: Record<string, 'green' | 'yellow' | 'red'> = { fast: 'green', slow: 'yellow', dead: 'red' }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {cell(L(fa, 'Products', 'کالاها'), d.kpis.products)}
        {cell(L(fa, 'Stock value', 'ارزش موجودی'), fmtMoney(d.kpis.totalValue, { max: 0 }))}
        {cell(L(fa, 'Class A', 'کلاس A'), d.kpis.aCount, 'text-success')}
        {cell(L(fa, 'Fast movers', 'پرگردش'), d.kpis.fastCount, 'text-success')}
        {cell(L(fa, 'Dead stock', 'راکد'), d.kpis.deadCount, d.kpis.deadCount ? 'text-danger' : 'text-text-tertiary')}
        {cell(L(fa, 'Below reorder', 'زیر نقطه سفارش'), d.kpis.belowReorder, d.kpis.belowReorder ? 'text-warning' : 'text-text-tertiary')}
        {cell(L(fa, 'Near expiry', 'نزدیک انقضا'), d.kpis.nearExpiryCount, d.kpis.nearExpiryCount ? 'text-danger' : 'text-text-tertiary')}
      </div>
      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'ABC / XYZ / movement analysis', 'تحلیل ABC / XYZ / گردش')}</h3>
        <DataTable tableId="inv-intel" locale={fa ? 'fa' : 'en'} rows={d.rows} rowKey={(r: IntelRow) => String(r.id)}
          columns={[
            { key: 'sku', labelEn: 'SKU', labelFa: 'کد', render: (r: IntelRow) => <span className="font-mono text-2xs text-text-tertiary">{r.sku}</span> },
            { key: 'name', labelEn: 'Product', labelFa: 'کالا', render: (r: IntelRow) => <span className="text-xs text-text-secondary">{r.name}</span> },
            { key: 'onHand', labelEn: 'On hand', labelFa: 'موجودی', numeric: true, render: (r: IntelRow) => <span className="text-xs">{r.onHand}</span> },
            { key: 'value', labelEn: 'Value', labelFa: 'ارزش', numeric: true, render: (r: IntelRow) => <span className="text-xs">{fmtMoney(r.value, { max: 0 })}</span> },
            { key: 'abc', labelEn: 'ABC', labelFa: 'ABC', render: (r: IntelRow) => <Badge color={r.abc === 'A' ? 'green' : r.abc === 'B' ? 'blue' : 'slate'}>{r.abc}</Badge> },
            { key: 'xyz', labelEn: 'XYZ', labelFa: 'XYZ', render: (r: IntelRow) => <Badge color={r.xyz === 'X' ? 'green' : r.xyz === 'Y' ? 'yellow' : 'red'}>{r.xyz}</Badge> },
            { key: 'movement', labelEn: 'Movement', labelFa: 'گردش', render: (r: IntelRow) => <Badge color={mv[r.movement] ?? 'slate'}>{r.movement}</Badge> },
            { key: 'turnover', labelEn: 'Turnover', labelFa: 'نسبت گردش', numeric: true, render: (r: IntelRow) => <span className="text-xs">{r.turnover}</span> },
            { key: 'aging', labelEn: 'Aging', labelFa: 'عمر موجودی', render: (r: IntelRow) => <span className="text-2xs text-text-tertiary">{r.aging}</span> },
            { key: 'eoq', labelEn: 'EOQ', labelFa: 'EOQ', numeric: true, render: (r: IntelRow) => <span className="text-xs">{r.eoq || '—'}</span> },
          ]} exportName="stock-intelligence" emptyLabel={L(fa, 'No stock yet.', 'موجودی نیست.')} />
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, 'Reorder suggestions', 'پیشنهاد سفارش مجدد')}</h3>
          {d.reorder.length === 0 ? <p className="text-2xs text-text-tertiary">{L(fa, 'Nothing below its reorder point.', 'چیزی زیر نقطه سفارش نیست.')}</p> : d.reorder.map(r => (
            <div key={r.id} className="flex justify-between py-1 text-xs border-b border-subtle last:border-0">
              <span className="text-text-secondary">{r.sku} — {r.name}</span>
              <span className="text-text-tertiary">{r.onHand}/{r.reorderPoint} → <b className="text-brand">{r.suggestedQty}</b></span>
            </div>
          ))}
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, 'Near-expiry batches', 'بچ‌های نزدیک انقضا')}</h3>
          {d.nearExpiry.length === 0 ? <p className="text-2xs text-text-tertiary">{L(fa, 'No batches near expiry.', 'بچی نزدیک انقضا نیست.')}</p> : d.nearExpiry.map(b => (
            <div key={b.id} className="flex justify-between py-1 text-xs border-b border-subtle last:border-0">
              <span className="text-text-secondary">{b.sku} · {b.batchNo}</span>
              <span className="text-danger">{b.expiryDate} ({b.qtyRemaining})</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ── Serial / Batch / IMEI tracking (PARTS 4/7) ───────────────────────────────
interface SerialHit { id: number; serial: string; imei: string | null; status: string; sku: string; nameEn: string; batchNo: string | null; warranty: string; createdAt: string; history: { type: string; qty: number; ref: string | null; createdAt: string }[] }
interface BatchRow { id: number; sku: string; nameEn: string; batchNo: string; productionDate: string | null; expiryDate: string | null; manufacturer: string | null; qtyRemaining: number; expiry: string }
export function TrackingTab({ fa, toast }: { fa: boolean; toast: Toast }) {
  const warehouses = useWarehouses()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SerialHit[]>([])
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [regP, setRegP] = useState<ProductOpt | null>(null)
  const [regWh, setRegWh] = useState('')
  const [regSerials, setRegSerials] = useState('')
  const [regWarranty, setRegWarranty] = useState('12')
  const [bP, setBP] = useState<ProductOpt | null>(null)
  const [bWh, setBWh] = useState('')
  const [bNo, setBNo] = useState('')
  const [bQty, setBQty] = useState('')
  const [bExp, setBExp] = useState('')
  const loadBatches = useCallback(() => { fetch(`${OPS}?view=batches`).then(r => r.json()).then(d => setBatches(d.batches ?? [])).catch(() => {}) }, [])
  useEffect(() => { loadBatches() }, [loadBatches])
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const t = setTimeout(() => fetch(`${OPS}?view=serial-search&q=${encodeURIComponent(q)}`).then(r => r.json()).then(d => setHits(d.hits ?? [])).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [q])

  async function register() {
    if (!regP || !regWh || !regSerials.trim()) { toast(L(fa, 'Product, warehouse and serials are required', 'کالا، انبار و سریال الزامی است'), 'error'); return }
    const serials = regSerials.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).map(s => {
      const [serial, imei] = s.split('|').map(x => x.trim())
      return { serial, imei: imei || undefined }
    })
    const r = await post('serial.register', { productId: regP.id, warehouseId: Number(regWh), serials, warrantyMonths: Number(regWarranty) || null })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(L(fa, `${d.registered} serial(s) registered`, `${d.registered} سریال ثبت شد`), 'success'); setRegSerials('') }
    else toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
  }
  async function registerB() {
    if (!bP || !bWh || !bNo.trim() || !Number(bQty)) { toast(L(fa, 'Product, warehouse, batch no and qty are required', 'کالا، انبار، شماره بچ و تعداد الزامی است'), 'error'); return }
    const r = await post('batch.register', { productId: bP.id, warehouseId: Number(bWh), batchNo: bNo.trim(), qty: Number(bQty), expiryDate: bExp || null })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(L(fa, 'Batch registered (+stock receipt)', 'بچ ثبت شد (+رسید موجودی)'), 'success'); setBNo(''); setBQty(''); setBExp(''); loadBatches() }
    else toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
  }
  function printLabels(items: { code: string; title: string }[]) {
    const svgs = items.map(i => {
      const svg = ean13Svg(i.code) ?? code39Svg(i.code) ?? ''
      return `<div style="display:inline-block;margin:8px;text-align:center"><div style="font:11px monospace">${i.title}</div>${svg}</div>`
    }).join('')
    const w = window.open('', '_blank', 'width=800,height=600')
    if (!w) return
    w.document.write(`<html><head><title>Labels</title></head><body onload="print()">${svgs}</body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, 'Search by serial / IMEI (scan input)', 'جستجوی سریال / IMEI (ورودی اسکن)')}</h3>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={L(fa, 'Scan or type a serial / IMEI…', 'سریال یا IMEI را اسکن یا تایپ کنید…')} className="form-input !py-1.5 text-xs w-full max-w-md" autoFocus />
        {hits.map(h => (
          <div key={h.id} className="mt-3 rounded-lg border border-subtle p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold text-text-primary font-mono">{h.serial}{h.imei && <span className="text-text-tertiary"> · IMEI {h.imei}</span>}</p>
              <div className="flex gap-1">
                <Badge color={h.status === 'in_stock' ? 'green' : h.status === 'sold' ? 'blue' : h.status === 'recalled' ? 'red' : 'yellow'}>{h.status}</Badge>
                <Badge color={h.warranty === 'active' ? 'green' : h.warranty === 'expiring' ? 'yellow' : 'slate'}>{L(fa, 'warranty', 'گارانتی')}: {h.warranty}</Badge>
              </div>
            </div>
            <p className="text-2xs text-text-tertiary mt-1">{h.sku} — {h.nameEn}{h.batchNo && <> · {L(fa, 'batch', 'بچ')} {h.batchNo}</>} · {h.createdAt}</p>
            {h.history.length > 0 && <div className="mt-2 border-t border-subtle pt-2">
              {h.history.map((m, i) => <p key={i} className="text-2xs text-text-tertiary">{m.createdAt} — {m.type} {m.qty} {m.ref && `(${m.ref})`}</p>)}
            </div>}
            <div className="mt-2"><Btn size="sm" variant="secondary" onClick={() => printLabels([{ code: h.imei ?? h.serial, title: `${h.sku} ${h.serial}` }])}>{L(fa, 'Print label', 'چاپ برچسب')}</Btn></div>
          </div>
        ))}
        {q.trim().length >= 2 && hits.length === 0 && <p className="mt-2 text-2xs text-text-tertiary">{L(fa, 'No serial found.', 'سریالی یافت نشد.')}</p>}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, 'Register serials (one per line; SERIAL|IMEI)', 'ثبت سریال (هر خط یکی؛ SERIAL|IMEI)')}</h3>
          <div className="space-y-2">
            <ProductPick fa={fa} onPick={setRegP} />
            {regP && <p className="text-2xs text-text-secondary">✓ {regP.sku} — {fa ? (regP.nameFa || regP.nameEn) : regP.nameEn}</p>}
            <select value={regWh} onChange={e => setRegWh(e.target.value)} className="form-input !py-1.5 text-xs w-full">
              <option value="">{L(fa, '— warehouse —', '— انبار —')}</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} · {w.nameEn}</option>)}
            </select>
            <textarea value={regSerials} onChange={e => setRegSerials(e.target.value)} rows={4} placeholder={'SN-001|490154203237518\nSN-002'} className="form-input text-xs w-full font-mono" />
            <div className="flex items-end gap-2">
              <Input label={L(fa, 'Warranty (months)', 'گارانتی (ماه)')} value={regWarranty} onChange={setRegWarranty} />
              <Btn size="sm" onClick={register}>{L(fa, '+ Register', '+ ثبت')}</Btn>
            </div>
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, 'Register batch / lot', 'ثبت بچ / سری ساخت')}</h3>
          <div className="space-y-2">
            <ProductPick fa={fa} onPick={setBP} />
            {bP && <p className="text-2xs text-text-secondary">✓ {bP.sku}</p>}
            <select value={bWh} onChange={e => setBWh(e.target.value)} className="form-input !py-1.5 text-xs w-full">
              <option value="">{L(fa, '— warehouse —', '— انبار —')}</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} · {w.nameEn}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <Input label={L(fa, 'Batch no', 'شماره بچ')} value={bNo} onChange={setBNo} />
              <Input label={L(fa, 'Qty', 'تعداد')} value={bQty} onChange={setBQty} />
              <Input label={L(fa, 'Expiry (YYYY-MM-DD)', 'انقضا')} value={bExp} onChange={setBExp} />
            </div>
            <Btn size="sm" onClick={registerB}>{L(fa, '+ Register batch', '+ ثبت بچ')}</Btn>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Batches & expiry', 'بچ‌ها و انقضا')}</h3>
        <DataTable tableId="inv-batches" locale={fa ? 'fa' : 'en'} rows={batches} rowKey={(b: BatchRow) => String(b.id)}
          columns={[
            { key: 'sku', labelEn: 'SKU', labelFa: 'کد', render: (b: BatchRow) => <span className="font-mono text-2xs">{b.sku}</span> },
            { key: 'batchNo', labelEn: 'Batch', labelFa: 'بچ', render: (b: BatchRow) => <span className="text-xs">{b.batchNo}</span> },
            { key: 'qtyRemaining', labelEn: 'Remaining', labelFa: 'باقیمانده', numeric: true, render: (b: BatchRow) => <span className="text-xs">{b.qtyRemaining}</span> },
            { key: 'expiryDate', labelEn: 'Expiry', labelFa: 'انقضا', render: (b: BatchRow) => <span className="text-2xs">{b.expiryDate ?? '—'}</span> },
            { key: 'expiry', labelEn: 'Status', labelFa: 'وضعیت', render: (b: BatchRow) => <Badge color={b.expiry === 'expired' ? 'red' : b.expiry === 'near' ? 'yellow' : b.expiry === 'ok' ? 'green' : 'slate'}>{b.expiry}</Badge> },
          ]} exportName="batches" emptyLabel={L(fa, 'No batches registered.', 'بچی ثبت نشده.')} />
      </Card>
    </div>
  )
}

// ── Stock ops: holds + cycle counts (PARTS 3/9) ──────────────────────────────
interface HoldRow { id: number; sku: string; nameEn: string; kind: string; qty: number; ref: string | null; status: string; createdAt: string }
interface CountRow { id: number; warehouseName: string; status: string; lines: number; variances: number; glEntryId: number | null; createdAt: string }
interface CountLineRow { productId: number; sku: string; nameEn: string; systemQty: number; countedQty: number | null; unitCost: number }
export function StockOpsTab({ fa, toast, canAdmin }: { fa: boolean; toast: Toast; canAdmin: boolean }) {
  const warehouses = useWarehouses()
  const [holds, setHolds] = useState<HoldRow[]>([])
  const [counts, setCounts] = useState<CountRow[]>([])
  const [hP, setHP] = useState<ProductOpt | null>(null)
  const [hWh, setHWh] = useState('')
  const [hKind, setHKind] = useState('reserve')
  const [hQty, setHQty] = useState('')
  const [cWh, setCWh] = useState('')
  const [detail, setDetail] = useState<{ id: number; lines: CountLineRow[] } | null>(null)
  const load = useCallback(() => {
    fetch(`${OPS}?view=holds`).then(r => r.json()).then(d => setHolds(d.holds ?? [])).catch(() => {})
    fetch(`${OPS}?view=counts`).then(r => r.json()).then(d => setCounts(d.counts ?? [])).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])
  const act = async (action: string, payload: Record<string, unknown>, okMsg: string) => {
    const r = await post(action, payload)
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(okMsg, 'success'); load(); return d }
    toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
    return null
  }
  async function openDetail(c: CountRow) {
    const d = await fetch(`${OPS}?view=count-detail&id=${c.id}`).then(r => r.json())
    setDetail({ id: c.id, lines: d.lines ?? [] })
  }
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, 'Reservations & holds (reserved / blocked / damaged)', 'رزرو و توقیف (رزرو / مسدود / خسارت)')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end mb-3">
          <div className="md:col-span-2"><ProductPick fa={fa} onPick={setHP} />{hP && <p className="text-2xs text-text-secondary mt-1">✓ {hP.sku}</p>}</div>
          <select value={hWh} onChange={e => setHWh(e.target.value)} className="form-input !py-1.5 text-xs"><option value="">{L(fa, '— warehouse —', '— انبار —')}</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.code}</option>)}</select>
          <select value={hKind} onChange={e => setHKind(e.target.value)} className="form-input !py-1.5 text-xs">
            <option value="reserve">{L(fa, 'Reserve', 'رزرو')}</option><option value="block">{L(fa, 'Block', 'مسدود')}</option><option value="damage">{L(fa, 'Damage', 'خسارت')}</option>
          </select>
          <div className="flex items-end gap-2">
            <Input label={L(fa, 'Qty', 'تعداد')} value={hQty} onChange={setHQty} />
            <Btn size="sm" onClick={() => { if (hP && hWh && Number(hQty)) act('hold.create', { productId: hP.id, warehouseId: Number(hWh), kind: hKind, qty: Number(hQty) }, L(fa, 'Hold created', 'ثبت شد')) }}>+</Btn>
          </div>
        </div>
        <DataTable tableId="inv-holds" locale={fa ? 'fa' : 'en'} rows={holds} rowKey={(h: HoldRow) => String(h.id)}
          columns={[
            { key: 'sku', labelEn: 'SKU', labelFa: 'کد', render: (h: HoldRow) => <span className="font-mono text-2xs">{h.sku}</span> },
            { key: 'kind', labelEn: 'Kind', labelFa: 'نوع', render: (h: HoldRow) => <Badge color={h.kind === 'reserve' ? 'blue' : h.kind === 'block' ? 'yellow' : 'red'}>{h.kind}</Badge> },
            { key: 'qty', labelEn: 'Qty', labelFa: 'تعداد', numeric: true, render: (h: HoldRow) => <span className="text-xs">{h.qty}</span> },
            { key: 'ref', labelEn: 'Ref', labelFa: 'مرجع', render: (h: HoldRow) => <span className="text-2xs text-text-tertiary">{h.ref ?? '—'}</span> },
            { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', render: (h: HoldRow) => <Badge color={h.status === 'active' ? 'green' : 'slate'}>{h.status}</Badge> },
          ]}
          rowActions={[{ id: 'release', labelEn: 'Release', labelFa: 'آزادسازی', icon: '↩', hidden: (h: HoldRow) => h.status !== 'active', onClick: (h: HoldRow) => act('hold.release', { id: h.id }, L(fa, 'Released', 'آزاد شد')) } as RowAction<HoldRow>]}
          exportName="holds" emptyLabel={L(fa, 'No holds.', 'موردی نیست.')} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Cycle counts (count → submit → approve → post + GL)', 'انبارگردانی (شمارش → ارسال → تأیید → ثبت + سند)')}</h3>
          <div className="flex gap-2">
            <select value={cWh} onChange={e => setCWh(e.target.value)} className="form-input !py-1.5 text-xs"><option value="">{L(fa, '— warehouse —', '— انبار —')}</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.code}</option>)}</select>
            <Btn size="sm" onClick={() => { if (cWh) act('count.create', { warehouseId: Number(cWh) }, L(fa, 'Count session created', 'جلسه شمارش ایجاد شد')) }}>{L(fa, '+ New count', '+ شمارش جدید')}</Btn>
          </div>
        </div>
        <DataTable tableId="inv-counts" locale={fa ? 'fa' : 'en'} rows={counts} rowKey={(c: CountRow) => String(c.id)}
          columns={[
            { key: 'id', labelEn: '#', labelFa: '#', render: (c: CountRow) => <span className="font-mono text-2xs">#{c.id}</span> },
            { key: 'warehouseName', labelEn: 'Warehouse', labelFa: 'انبار', render: (c: CountRow) => <span className="text-xs">{c.warehouseName}</span> },
            { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', render: (c: CountRow) => <Badge color={c.status === 'posted' ? 'green' : c.status === 'approved' ? 'blue' : 'yellow'}>{c.status}</Badge> },
            { key: 'lines', labelEn: 'Lines', labelFa: 'ردیف', numeric: true, render: (c: CountRow) => <span className="text-xs">{c.lines}</span> },
            { key: 'variances', labelEn: 'Variances', labelFa: 'مغایرت', numeric: true, render: (c: CountRow) => <span className={c.variances ? 'text-warning text-xs' : 'text-xs'}>{c.variances}</span> },
            { key: 'glEntryId', labelEn: 'GL', labelFa: 'سند', render: (c: CountRow) => <span className="text-2xs text-text-tertiary">{c.glEntryId ? `JV#${c.glEntryId}` : '—'}</span> },
          ]}
          rowActions={[
            { id: 'enter', labelEn: 'Enter counts', labelFa: 'ورود شمارش', icon: '✎', hidden: (c: CountRow) => c.status !== 'counting', onClick: openDetail },
            { id: 'submit', labelEn: 'Submit', labelFa: 'ارسال', icon: '➤', hidden: (c: CountRow) => c.status !== 'counting', onClick: (c: CountRow) => act('count.transition', { id: c.id, to: 'submitted' }, L(fa, 'Submitted', 'ارسال شد')) },
            { id: 'approve', labelEn: 'Approve', labelFa: 'تأیید', icon: '✓', hidden: (c: CountRow) => c.status !== 'submitted' || !canAdmin, onClick: (c: CountRow) => act('count.transition', { id: c.id, to: 'approved' }, L(fa, 'Approved', 'تأیید شد')) },
            { id: 'post', labelEn: 'Post (moves + GL)', labelFa: 'ثبت (حرکت + سند)', icon: '📒', hidden: (c: CountRow) => c.status !== 'approved' || !canAdmin, onClick: (c: CountRow) => act('count.post', { id: c.id }, L(fa, 'Posted', 'ثبت شد')) },
          ] as RowAction<CountRow>[]}
          exportName="cycle-counts" emptyLabel={L(fa, 'No count sessions.', 'جلسه‌ای نیست.')} />
        {detail && (
          <div className="mt-3 rounded-lg border border-subtle p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-text-primary">{L(fa, `Count #${detail.id} — enter counted quantities`, `شمارش #${detail.id} — مقادیر شمارش‌شده`)}</h4>
              <Btn size="sm" variant="secondary" onClick={() => setDetail(null)}>{L(fa, 'Close', 'بستن')}</Btn>
            </div>
            {detail.lines.map((l, i) => (
              <div key={l.productId} className="flex items-center gap-2 py-1 text-xs">
                <span className="w-40 font-mono text-2xs text-text-tertiary">{l.sku}</span>
                <span className="flex-1 text-text-secondary">{l.nameEn}</span>
                <span className="text-text-tertiary">{L(fa, 'system', 'سیستم')}: {l.systemQty}</span>
                <input type="number" defaultValue={l.countedQty ?? ''} onChange={e => { detail.lines[i] = { ...l, countedQty: e.target.value === '' ? null : Number(e.target.value) } }} className="form-input !py-1 text-xs w-24" />
              </div>
            ))}
            <Btn size="sm" className="mt-2" onClick={() => act('count.enter', { id: detail.id, entries: detail.lines.filter(l => l.countedQty != null).map(l => ({ productId: l.productId, countedQty: l.countedQty })) }, L(fa, 'Counts saved', 'ذخیره شد'))}>{L(fa, 'Save counts', 'ذخیرهٔ شمارش')}</Btn>
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Logistics: shipments (PART 6) ────────────────────────────────────────────
interface ShipmentRow { id: number; shipmentNo: string; warehouseName: string; carrier: string | null; trackingNo: string | null; status: string; qty: number; createdAt: string; shippedAt: string | null }
export function LogisticsTab({ fa, toast }: { fa: boolean; toast: Toast }) {
  const warehouses = useWarehouses()
  const [ships, setShips] = useState<ShipmentRow[]>([])
  const [sWh, setSWh] = useState('')
  const [sCarrier, setSCarrier] = useState('')
  const [sP, setSP] = useState<ProductOpt | null>(null)
  const [sQty, setSQty] = useState('')
  const [lines, setLines] = useState<{ productId: number; sku: string; qty: number }[]>([])
  const load = useCallback(() => { fetch(`${OPS}?view=shipments`).then(r => r.json()).then(d => setShips(d.shipments ?? [])).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])
  const advance = async (s: ShipmentRow, to: string) => {
    const trackingNo = to === 'shipped' ? window.prompt(L(fa, 'Tracking number (optional):', 'شماره رهگیری (اختیاری):')) ?? undefined : undefined
    const r = await post('shipment.advance', { id: s.id, to, trackingNo: trackingNo || undefined })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(`${s.shipmentNo} → ${to}`, 'success'); load() } else toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
  }
  const NEXT: Record<string, string[]> = { draft: ['picking'], picking: ['packed'], packed: ['shipped'], shipped: ['delivered', 'returned'], delivered: ['returned'] }
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, 'New shipment (reserves stock until shipped)', 'حمل جدید (تا زمان ارسال، موجودی رزرو می‌شود)')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end mb-2">
          <select value={sWh} onChange={e => setSWh(e.target.value)} className="form-input !py-1.5 text-xs"><option value="">{L(fa, '— warehouse —', '— انبار —')}</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.code}</option>)}</select>
          <Input label={L(fa, 'Carrier', 'حامل')} value={sCarrier} onChange={setSCarrier} />
          <div className="md:col-span-2"><ProductPick fa={fa} onPick={setSP} />{sP && <p className="text-2xs text-text-secondary mt-1">✓ {sP.sku}</p>}</div>
        </div>
        <div className="flex items-end gap-2 mb-2">
          <Input label={L(fa, 'Qty', 'تعداد')} value={sQty} onChange={setSQty} />
          <Btn size="sm" variant="secondary" onClick={() => { if (sP && Number(sQty)) { setLines(ls => [...ls, { productId: sP.id, sku: sP.sku, qty: Number(sQty) }]); setSQty('') } }}>{L(fa, '+ Line', '+ ردیف')}</Btn>
          <Btn size="sm" onClick={async () => {
            if (!sWh || lines.length === 0) { toast(L(fa, 'Warehouse and at least one line required', 'انبار و حداقل یک ردیف الزامی است'), 'error'); return }
            const r = await post('shipment.create', { warehouseId: Number(sWh), carrier: sCarrier || undefined, lines: lines.map(l => ({ productId: l.productId, qty: l.qty })) })
            const d = await r.json().catch(() => ({}))
            if (r.ok) { toast(`${d.shipmentNo} ${L(fa, 'created', 'ایجاد شد')}`, 'success'); setLines([]); load() } else toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
          }}>{L(fa, 'Create shipment', 'ایجاد حمل')}</Btn>
        </div>
        {lines.length > 0 && <p className="text-2xs text-text-tertiary">{lines.map(l => `${l.sku}×${l.qty}`).join(' · ')}</p>}
      </Card>
      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Shipments (pick → pack → ship → deliver / return)', 'حمل‌ها (برداشت → بسته‌بندی → ارسال → تحویل / برگشت)')}</h3>
        <DataTable tableId="inv-shipments" locale={fa ? 'fa' : 'en'} rows={ships} rowKey={(s: ShipmentRow) => String(s.id)}
          columns={[
            { key: 'shipmentNo', labelEn: 'No.', labelFa: 'شماره', render: (s: ShipmentRow) => <span className="font-mono text-2xs">{s.shipmentNo}</span> },
            { key: 'warehouseName', labelEn: 'Warehouse', labelFa: 'انبار', render: (s: ShipmentRow) => <span className="text-xs">{s.warehouseName}</span> },
            { key: 'qty', labelEn: 'Qty', labelFa: 'تعداد', numeric: true, render: (s: ShipmentRow) => <span className="text-xs">{s.qty}</span> },
            { key: 'carrier', labelEn: 'Carrier', labelFa: 'حامل', render: (s: ShipmentRow) => <span className="text-2xs text-text-tertiary">{s.carrier ?? '—'}{s.trackingNo && ` · ${s.trackingNo}`}</span> },
            { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', render: (s: ShipmentRow) => <Badge color={s.status === 'delivered' ? 'green' : s.status === 'shipped' ? 'blue' : s.status === 'returned' || s.status === 'cancelled' ? 'red' : 'yellow'}>{s.status}</Badge> },
          ]}
          rowActions={[
            { id: 'advance', labelEn: 'Advance', labelFa: 'مرحلهٔ بعد', icon: '→', hidden: (s: ShipmentRow) => !(NEXT[s.status]?.length), onClick: (s: ShipmentRow) => advance(s, NEXT[s.status][0]) },
            { id: 'return', labelEn: 'Return', labelFa: 'برگشت', icon: '↩', danger: true, hidden: (s: ShipmentRow) => !['shipped', 'delivered'].includes(s.status), onClick: (s: ShipmentRow) => advance(s, 'returned') },
            { id: 'cancel', labelEn: 'Cancel', labelFa: 'لغو', icon: '✕', danger: true, hidden: (s: ShipmentRow) => !['draft', 'picking', 'packed'].includes(s.status), onClick: (s: ShipmentRow) => advance(s, 'cancelled') },
          ] as RowAction<ShipmentRow>[]}
          exportName="shipments" emptyLabel={L(fa, 'No shipments yet.', 'حملی نیست.')} />
      </Card>
    </div>
  )
}
