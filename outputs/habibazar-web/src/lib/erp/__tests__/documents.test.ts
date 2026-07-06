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
