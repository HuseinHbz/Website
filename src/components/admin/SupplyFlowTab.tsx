'use client'

/**
 * PROC-FLOW-1 بند۴ — per-role work queues on the shared Enterprise DataTable.
 * No parallel component: the Finance side reuses the EXISTING Approval Center
 * inbox (`/admin/approvals`) as-is — only the two genuinely new queues needed
 * here (Warehouse Keeper's goods-request panel, Procurement's supply-note +
 * service-request inbox) get UI.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, Badge, useToast } from '@/components/admin/ui'
import { DataTable, type RowAction } from '@/components/admin/DataTable'

type Toast = ReturnType<typeof useToast>['toast']
const L = (fa: boolean, en: string, faS: string) => (fa ? faS : en)

interface SupplyNote {
  id: number; noteNo: string | null; productId: number; warehouseId: number
  qtyNeeded: number; qtyAvailableSnapshot: number; status: string
  linkedPurchaseDocumentId: number | null; productName?: string; warehouseName?: string; createdAt: string
}
interface ServiceRequest {
  id: number; requestNo: string | null; description: string; vendorId: number | null
  status: string; linkedPurchaseDocumentId: number | null; createdAt: string
}

const NOTE_STATUS_COLOR: Record<string, 'slate' | 'yellow' | 'blue' | 'green' | 'red'> = {
  raised: 'slate', sent_to_procurement: 'yellow', linked_to_purchase: 'blue', closed: 'green', cancelled: 'red',
}
const REQ_STATUS_COLOR: Record<string, 'slate' | 'yellow' | 'blue' | 'green'> = {
  requested: 'slate', quoted: 'yellow', invoiced: 'blue', financial_doc_sent: 'blue', closed: 'green',
}

async function post(action: string, body: Record<string, unknown>) {
  const r = await fetch('/api/admin/erp/purchasing/supply-flow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error ?? 'Request failed')
  return j
}

/** Warehouse Keeper's panel: "Stock shortages & supply notes" — بند۴ item 1. */
export function GoodsRequestPanel({ fa, toast, products, warehouses }: {
  fa: boolean; toast: Toast
  products: { id: number; label: string }[]; warehouses: { id: number; label: string }[]
}) {
  const [productId, setProductId] = useState<number | ''>('')
  const [warehouseId, setWarehouseId] = useState<number | ''>('')
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<SupplyNote[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/erp/purchasing/supply-flow?view=supply-notes').then(r => r.json()).then(d => setNotes(d.notes ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!productId || !warehouseId || !qty || Number(qty) <= 0) { toast(L(fa, 'Select a product, warehouse and a positive quantity.', 'کالا، انبار و مقدار مثبت را انتخاب کنید.'), 'error'); return }
    setBusy(true)
    try {
      const r = await post('requestGoods', { productId, warehouseId, qty: Number(qty) })
      toast(r.delivered
        ? L(fa, 'Delivered directly — sufficient stock on hand.', 'به‌صورت مستقیم تحویل شد — موجودی کافی بود.')
        : L(fa, `Supply note ${r.noteNo} raised — sent to Procurement.`, `برگ تأمین ${r.noteNo} صادر شد — به تدارکات ارسال شد.`), 'success')
      setQty(''); load()
    } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Request goods', 'درخواست کالا')}</h3>
        <div className="grid sm:grid-cols-4 gap-3">
          <Select value={String(productId)} onChange={v => setProductId(v ? Number(v) : '')}
            options={[{ value: '', label: L(fa, 'Product…', 'کالا…') }, ...products.map(p => ({ value: String(p.id), label: p.label }))]} />
          <Select value={String(warehouseId)} onChange={v => setWarehouseId(v ? Number(v) : '')}
            options={[{ value: '', label: L(fa, 'Warehouse…', 'انبار…') }, ...warehouses.map(w => ({ value: String(w.id), label: w.label }))]} />
          <Input type="number" placeholder={L(fa, 'Quantity', 'مقدار')} value={qty} onChange={setQty} />
          <Btn onClick={submit} disabled={busy}>{L(fa, 'Request', 'درخواست')}</Btn>
        </div>
        <p className="text-2xs text-text-tertiary mt-2">
          {L(fa, 'Checks real on-hand stock: enough → delivered immediately. Short → a supply note is raised for Procurement.',
            'موجودی واقعی بررسی می‌شود: کافی → تحویل فوری. کسری → برگ تأمین برای تدارکات صادر می‌شود.')}
        </p>
      </Card>
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'My supply notes', 'برگ‌های تأمین من')}</h3>
        <DataTable tableId="supply-notes-wk" locale={fa ? 'fa' : 'en'} loading={loading} rows={notes} rowKey={(n: SupplyNote) => String(n.id)}
          columns={[
            { key: 'noteNo', labelEn: 'Note #', labelFa: 'شماره', render: (n: SupplyNote) => <span className="font-mono text-2xs">{n.noteNo}</span> },
            { key: 'productName', labelEn: 'Product', labelFa: 'کالا', render: (n: SupplyNote) => <span className="text-xs">{n.productName ?? n.productId}</span> },
            { key: 'warehouseName', labelEn: 'Warehouse', labelFa: 'انبار', render: (n: SupplyNote) => <span className="text-xs">{n.warehouseName ?? n.warehouseId}</span> },
            { key: 'qtyNeeded', labelEn: 'Qty needed', labelFa: 'مقدار نیاز', numeric: true, render: (n: SupplyNote) => <span className="text-xs">{n.qtyNeeded}</span> },
            { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', render: (n: SupplyNote) => <Badge color={NOTE_STATUS_COLOR[n.status] ?? 'slate'}>{n.status}</Badge> },
          ]} exportName="supply-notes" emptyLabel={L(fa, 'No supply notes yet.', 'هنوز برگ تأمینی نیست.')} />
      </Card>
    </div>
  )
}

/** Procurement's inbox: supply notes → convert/request-payment — بند۴ item 2. */
export function ProcurementSupplyQueue({ fa, toast, vendors }: { fa: boolean; toast: Toast; vendors: { id: number; label: string }[] }) {
  const [notes, setNotes] = useState<SupplyNote[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/erp/purchasing/supply-flow?view=supply-notes&status=sent_to_procurement').then(r => r.json()).then(d => setNotes(d.notes ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const convert = async (n: SupplyNote) => {
    const vendorId = vendors[0]?.id
    try { await post('convertToPurchase', { noteId: n.id, vendorId }); toast(L(fa, 'Converted to a purchase request.', 'به درخواست خرید تبدیل شد.'), 'success'); load() }
    catch (e) { toast((e as Error).message, 'error') }
  }
  const requestPayment = async (n: SupplyNote) => {
    const amount = Number(window.prompt(L(fa, 'Payment amount (IRR)', 'مبلغ پرداخت (ریال)')) ?? '')
    if (!amount || amount <= 0) return
    try {
      await post('requestCashPayment', { noteId: n.id, amount, title: L(fa, `Cash purchase for note ${n.noteNo}`, `پرداخت نقدی برای برگ ${n.noteNo}`) })
      toast(L(fa, 'Payment request sent to the Approval Center.', 'درخواست پرداخت به مرکز تأیید ارسال شد.'), 'success')
      load()
    } catch (e) { toast((e as Error).message, 'error') }
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Supply note inbox', 'صندوق برگ‌های تأمین')}</h3>
      <DataTable tableId="supply-notes-proc" locale={fa ? 'fa' : 'en'} loading={loading} rows={notes} rowKey={(n: SupplyNote) => String(n.id)}
        columns={[
          { key: 'noteNo', labelEn: 'Note #', labelFa: 'شماره', render: (n: SupplyNote) => <span className="font-mono text-2xs">{n.noteNo}</span> },
          { key: 'productName', labelEn: 'Product', labelFa: 'کالا', render: (n: SupplyNote) => <span className="text-xs">{n.productName ?? n.productId}</span> },
          { key: 'qtyNeeded', labelEn: 'Qty needed', labelFa: 'مقدار نیاز', numeric: true, render: (n: SupplyNote) => <span className="text-xs">{n.qtyNeeded}</span> },
          { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', render: (n: SupplyNote) => <Badge color={NOTE_STATUS_COLOR[n.status] ?? 'slate'}>{n.status}</Badge> },
        ]}
        rowActions={[
          { id: 'convert', labelEn: 'Convert to purchase', labelFa: 'تبدیل به خرید', icon: '→', onClick: convert } as RowAction<SupplyNote>,
          { id: 'cash', labelEn: 'Request payment (cash)', labelFa: 'درخواست پرداخت نقدی', icon: '৳', onClick: requestPayment } as RowAction<SupplyNote>,
        ]}
        exportName="supply-notes-inbox" emptyLabel={L(fa, 'No pending supply notes.', 'برگ تأمین در انتظاری نیست.')} />
    </Card>
  )
}

/** Service requests — بند۳.۳. Shared by the requesting unit (create) and Procurement (invoice). */
export function ServiceRequestsPanel({ fa, toast }: { fa: boolean; toast: Toast }) {
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [description, setDescription] = useState('')
  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/erp/purchasing/supply-flow?view=service-requests').then(r => r.json()).then(d => setRequests(d.requests ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!description.trim()) return
    try { await post('createServiceRequest', { description }); setDescription(''); load() }
    catch (e) { toast((e as Error).message, 'error') }
  }
  const invoice = async (r: ServiceRequest) => {
    const amount = Number(window.prompt(L(fa, 'Service amount (IRR)', 'مبلغ خدمات (ریال)')) ?? '')
    if (!amount || amount <= 0) return
    try {
      await post('createServiceInvoice', { requestId: r.id, lines: [{ description: r.description, amount }] })
      toast(L(fa, 'Service invoice created.', 'فاکتور خدمات ایجاد شد.'), 'success')
      load()
    } catch (e) { toast((e as Error).message, 'error') }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'New service request', 'درخواست خدمات جدید')}</h3>
        <div className="flex gap-3">
          <Input className="flex-1" placeholder={L(fa, 'Describe the service needed…', 'توضیح خدمات مورد نیاز…')} value={description} onChange={setDescription} />
          <Btn onClick={create}>{L(fa, 'Create', 'ایجاد')}</Btn>
        </div>
      </Card>
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Service requests', 'درخواست‌های خدمات')}</h3>
        <DataTable tableId="service-requests" locale={fa ? 'fa' : 'en'} loading={loading} rows={requests} rowKey={(r: ServiceRequest) => String(r.id)}
          columns={[
            { key: 'requestNo', labelEn: 'Request #', labelFa: 'شماره', render: (r: ServiceRequest) => <span className="font-mono text-2xs">{r.requestNo}</span> },
            { key: 'description', labelEn: 'Description', labelFa: 'توضیح', render: (r: ServiceRequest) => <span className="text-xs">{r.description}</span> },
            { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', render: (r: ServiceRequest) => <Badge color={REQ_STATUS_COLOR[r.status] ?? 'slate'}>{r.status}</Badge> },
          ]}
          rowActions={[
            { id: 'invoice', labelEn: 'Create service invoice', labelFa: 'ایجاد فاکتور خدمات', icon: '৳', hidden: (r: ServiceRequest) => !['requested', 'quoted'].includes(r.status), onClick: invoice } as RowAction<ServiceRequest>,
          ]}
          exportName="service-requests" emptyLabel={L(fa, 'No service requests yet.', 'درخواست خدماتی نیست.')} />
      </Card>
    </div>
  )
}
