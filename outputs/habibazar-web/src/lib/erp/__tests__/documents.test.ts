import { describe, it, expect } from 'vitest'
import { escapeHtml, money, buildSalesPayload, renderDocumentHtml, defaultTitle, type DocModel } from '../documents'

describe('document helpers', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<script>"&'`)).toBe('&lt;script&gt;&quot;&amp;&#39;')
  })
  it('formats money by currency', () => {
    expect(money(1234.5, 'USD')).toBe('$1,234.50')
    expect(money(1000, 'EUR')).toBe('€1,000.00')
  })
  it('has a title per type', () => {
    expect(defaultTitle('invoice')).toBe('INVOICE')
    expect(defaultTitle('completion_certificate')).toBe('CERTIFICATE OF COMPLETION')
  })
})

describe('buildSalesPayload', () => {
  it('computes line and document totals (qty×price, discount, tax)', () => {
    const p = buildSalesPayload([
      { description: 'Widget', qty: 10, unitPrice: 100, discountPct: 10, taxPct: 9 },
      { description: 'Setup', qty: 2, unitPrice: 50, discountPct: 0, taxPct: 9 },
    ], 'USD')
    expect(p.subtotal).toBe(1100)
    expect(p.discountTotal).toBe(100)
    expect(p.taxTotal).toBe(90)
    expect(p.total).toBe(1090)
    expect(p.lines[0].lineTotal).toBe(981)
  })
})

describe('renderDocumentHtml', () => {
  const model: DocModel = {
    type: 'invoice', number: 'INV-1', date: '2026-07-06', title: 'INVOICE',
    partyName: 'Acme <Corp>', issuerName: 'HBZ',
    payload: buildSalesPayload([{ description: 'A & B', qty: 1, unitPrice: 100, discountPct: 0, taxPct: 0 }], 'USD', [{ label: 'PO', value: '123' }]),
    verifyCode: 'ABC123', verifyUrl: 'https://x/verify/ABC123',
  }
  const html = renderDocumentHtml(model, 'data:image/png;base64,QQ==')

  it('is a complete HTML document with the number, party and total', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('INV-1')
    expect(html).toContain('$100.00')
    expect(html).toContain('data:image/png;base64,QQ==')
  })
  it('escapes untrusted party/line text (no raw angle brackets injected)', () => {
    expect(html).toContain('Acme &lt;Corp&gt;')
    expect(html).toContain('A &amp; B')
    expect(html).not.toContain('Acme <Corp>')
  })
  it('embeds the verify code and a print control', () => {
    expect(html).toContain('ABC123')
    expect(html).toContain('window.print()')
  })
})

import { safeAccent, renderDocumentHtml as render2, type DocModel as DM2 } from '../documents'

describe('branding + designer template render (Phase 26)', () => {
  const base: DM2 = {
    type: 'invoice', number: 'INV-1', date: '2026-07-10', title: 'INVOICE',
    partyName: 'Acme <Corp>', issuerName: 'HBZ',
    payload: { lines: [], subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0, currency: 'USD', meta: [] },
    verifyCode: 'ABC123', verifyUrl: 'https://x/verify/ABC123',
  }
  it('renders company identity, bank and contact from branding (escaped)', () => {
    const html = render2({ ...base, branding: { regNo: '12345', economicCode: 'EC-9', iban: 'IR12', bankName: 'Melli', phone: '021', email: 'x@y.z', logoUrl: '/uploads/logo.png' } }, 'data:image/png;base64,x')
    expect(html).toContain('Reg. no: 12345')
    expect(html).toContain('Economic code: EC-9')
    expect(html).toContain('IBAN IR12')
    expect(html).toContain('/uploads/logo.png')
    expect(html).toContain('Acme &lt;Corp&gt;') // XSS escape preserved
  })
  it('applies template config: watermark, accent, terms, custom fields, QR toggle', () => {
    const html = render2({ ...base, template: { watermarkText: 'UNOFFICIAL', accentColor: '#ff0000', terms: 'Pay in 30 days', customFields: [{ label: 'Project', value: 'Datacenter' }], showQr: false } }, 'data:image/png;base64,x')
    expect(html).toContain('UNOFFICIAL')
    expect(html).toContain('#ff0000')
    expect(html).toContain('Pay in 30 days')
    expect(html).toContain('Datacenter')
    expect(html).not.toContain('data:image/png;base64,x') // QR hidden
  })
  it('safeAccent rejects CSS injection and falls back', () => {
    expect(safeAccent('#22c55e')).toBe('#22c55e')
    expect(safeAccent('red;}body{display:none')).toBe('#4f46e5')
    expect(safeAccent(undefined)).toBe('#4f46e5')
  })
})
