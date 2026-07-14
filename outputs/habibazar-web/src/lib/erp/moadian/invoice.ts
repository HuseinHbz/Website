/**
 * سامانه مودیان — standard electronic invoice builder (Phase 26.24 بند ۴.۱).
 * Pure, deterministic, unit-tested. Maps a sales_document into the Iranian Tax
 * Administration's standard invoice structure (صورتحساب الکترونیکی): header
 * (sarBargeh), body lines (aghlam), and totals — the shape the مودیان API and
 * the memory-taxpayer (حافظه مالیاتی) expect. No network here; the data layer
 * signs + queues. Field names follow the tax spec's transliteration.
 */

export type InvoicePattern = '1' | '2' // 1 = فروش، 2 = فروش ارزی/صادرات (simplified)

export interface MoadianParty {
  /** کد اقتصادی / شناسه ملی */ economicCode?: string | null
  /** شناسه ملی حقوقی یا کد ملی حقیقی */ nationalId?: string | null
  name: string
  /** حقیقی=1 / حقوقی=2 */ tccim?: 1 | 2
}

export interface MoadianLineInput {
  /** شناسه کالا/خدمت (13-digit stuff code); falls back to a service placeholder */
  stuffId?: string | null
  description: string
  quantity: number
  unitPrice: number     // مبلغ واحد (Rial)
  discount: number      // تخفیف (Rial)
  vatRate: number       // نرخ مالیات بر ارزش افزوده (%)
}

export interface MoadianInvoiceInput {
  pattern: InvoicePattern
  serial: string        // شماره صورتحساب داخلی (doc_no)
  issueDateMs: number   // تاریخ صدور (epoch ms)
  seller: MoadianParty
  buyer: MoadianParty
  lines: MoadianLineInput[]
  taxId?: string        // شماره منحصربه‌فرد مالیاتی (assigned/precomputed)
}

// ── Standard line (قلم) ──────────────────────────────────────────────────────
export interface MoadianLine {
  sstid: string   // شناسه کالا/خدمت
  sstt: string    // شرح
  am: number      // تعداد/مقدار
  fee: number     // مبلغ واحد
  dis: number     // تخفیف
  prdis: number   // مبلغ پس از تخفیف
  vra: number     // نرخ مالیات
  vam: number     // مبلغ مالیات
  tsstam: number  // مبلغ کل قلم (پس از تخفیف + مالیات)
}

export interface MoadianInvoice {
  header: {
    taxid: string       // شماره منحصربه‌فرد مالیاتی
    indatim: number     // تاریخ صدور (ms)
    inty: 1             // نوع صورتحساب
    inp: InvoicePattern // الگو
    ins: 1              // نوع فروش
    tins: string        // شناسه/کد اقتصادی فروشنده
    tinb: string        // شناسه خریدار
    tprdis: number      // جمع کل تخفیف
    tdis: number        // جمع تخفیف
    tadis: number       // جمع پس از تخفیف
    tvam: number        // جمع مالیات بر ارزش افزوده
    tbill: number       // مبلغ کل صورتحساب
  }
  body: MoadianLine[]
}

const r0 = (n: number) => Math.round(n)

/** Build a single standard line from an input line. */
export function buildLine(l: MoadianLineInput): MoadianLine {
  const gross = l.unitPrice * l.quantity
  const afterDiscount = Math.max(0, gross - l.discount)
  const vam = r0((afterDiscount * l.vatRate) / 100)
  return {
    sstid: l.stuffId || '2001000000000', // generic service stuff-id fallback
    sstt: l.description.slice(0, 200),
    am: l.quantity,
    fee: r0(l.unitPrice),
    dis: r0(l.discount),
    prdis: r0(afterDiscount),
    vra: l.vatRate,
    vam,
    tsstam: r0(afterDiscount + vam),
  }
}

/** Build the full standard electronic invoice. Totals are derived (never trusted
 *  from the caller) so the مودیان submission always self-reconciles. */
export function buildInvoice(input: MoadianInvoiceInput): MoadianInvoice {
  const body = input.lines.map(buildLine)
  const tdis = body.reduce((s, l) => s + l.dis, 0)
  const tadis = body.reduce((s, l) => s + l.prdis, 0)
  const tvam = body.reduce((s, l) => s + l.vam, 0)
  const tbill = body.reduce((s, l) => s + l.tsstam, 0)
  return {
    header: {
      taxid: input.taxId ?? '',
      indatim: input.issueDateMs,
      inty: 1,
      inp: input.pattern,
      ins: 1,
      tins: input.seller.economicCode || input.seller.nationalId || '',
      tinb: input.buyer.economicCode || input.buyer.nationalId || '',
      tprdis: body.reduce((s, l) => s + l.prdis + l.dis, 0),
      tdis,
      tadis,
      tvam,
      tbill,
    },
    body,
  }
}

/** Validate an invoice before submission → list of blocking problems (empty = ok). */
export function validateInvoice(inv: MoadianInvoice): string[] {
  const errs: string[] = []
  if (!inv.header.tins) errs.push('کد اقتصادی/شناسه فروشنده الزامی است')
  if (inv.body.length === 0) errs.push('صورتحساب حداقل یک قلم باید داشته باشد')
  const recomputed = inv.body.reduce((s, l) => s + l.tsstam, 0)
  if (Math.abs(recomputed - inv.header.tbill) > 1) errs.push('جمع کل صورتحساب با اقلام همخوانی ندارد')
  for (const l of inv.body) if (l.am <= 0 || l.fee < 0) errs.push(`قلم «${l.sstt}» مقدار/مبلغ نامعتبر دارد`)
  return errs
}
