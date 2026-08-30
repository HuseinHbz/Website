import { describe, it, expect } from 'vitest'
import { businessError, toApiResponse, CATALOG, ERROR_CODES } from '../index'

describe('error catalog', () => {
  it('every code has a definition with matching http status/severity/module and both languages', () => {
    for (const code of ERROR_CODES) {
      const def = CATALOG[code]
      expect(def.code).toBe(code)
      expect(def.httpStatus).toBeGreaterThanOrEqual(400)
      expect(typeof def.severity).toBe('string')
      expect(typeof def.module).toBe('string')
      expect(typeof def.recoverable).toBe('boolean')
    }
  })
})

describe('businessError', () => {
  it('renders the credit-limit-exceeded error with both languages and the params interpolated', () => {
    const err = businessError('ERP-SALES-CREDIT-LIMIT-EXCEEDED', { limit: '10,000,000', projected: '12,500,000' })
    expect(err.code).toBe('ERP-SALES-CREDIT-LIMIT-EXCEEDED')
    expect(err.httpStatus).toBe(400)
    expect(err.en).toContain('10,000,000')
    expect(err.en).toContain('12,500,000')
    expect(err.en).toContain('Customer credit limit')
    expect(err.fa).toContain('10,000,000')
    expect(err.fa).toContain('سقف اعتبار مشتری')
    expect(err.recoverable).toBe(true)
  })

  it('ERP-SALES-CUSTOMER-NOT-FOUND: a nonexistent customerId returns 404, not a raw FK-violation 500', () => {
    const err = businessError('ERP-SALES-CUSTOMER-NOT-FOUND', {})
    expect(err.httpStatus).toBe(404)
    expect(err.en).toContain('does not exist')
    expect(err.fa).toContain('وجود ندارد')
  })

  it('ERP-SALES-VOID-PAID-INVOICE-BLOCKED (BUG-013 rule): a paid invoice must never be voided directly', () => {
    const err = businessError('ERP-SALES-VOID-PAID-INVOICE-BLOCKED', {})
    expect(err.httpStatus).toBe(400)
    expect(err.en).toContain('cannot be voided directly')
    expect(err.fa).toContain('قابل ابطال نیست')
    expect(err.recoverable).toBe(true)
  })

  it('ERP-FINANCE-JOURNAL-UNBALANCED interpolates the pure engine\'s reason string in both languages', () => {
    const err = businessError('ERP-FINANCE-JOURNAL-UNBALANCED', { reason: 'debit 100 != credit 90' })
    expect(err.httpStatus).toBe(400)
    expect(err.en).toContain('debit 100 != credit 90')
    expect(err.fa).toContain('debit 100 != credit 90')
  })

  it('ERP-FINANCE-POSTED-ENTRY-IMMUTABLE: only a draft is deletable, both languages say so', () => {
    const err = businessError('ERP-FINANCE-POSTED-ENTRY-IMMUTABLE', {})
    expect(err.en).toContain('draft')
    expect(err.fa).toContain('پیش‌نویس')
  })

  it('ERP-PURCHASING-PAYMENT-BLOCKED-MISMATCH (Phase 5 three-way match): interpolates the mismatch reasons in both languages', () => {
    const err = businessError('ERP-PURCHASING-PAYMENT-BLOCKED-MISMATCH', { reasons: 'invoice qty 120 exceeds ordered qty 100' })
    expect(err.httpStatus).toBe(400)
    expect(err.en).toContain('invoice qty 120 exceeds ordered qty 100')
    expect(err.fa).toContain('invoice qty 120 exceeds ordered qty 100')
    expect(err.fa).toContain('قابل پرداخت نیست')
  })

  it('ERP-SALES-INSUFFICIENT-STOCK (Phase 6 reservation gate): interpolates the reason in both languages', () => {
    const err = businessError('ERP-SALES-INSUFFICIENT-STOCK', { reason: 'Only 3 available (on-hand 10 − held 7)' })
    expect(err.httpStatus).toBe(400)
    expect(err.en).toContain('Only 3 available')
    expect(err.fa).toContain('موجودی کافی')
  })

  it('ERP-SALES-DELIVERY-EXCEEDS-RESERVATION (Phase 6 delivery gate): interpolates the reason in both languages', () => {
    const err = businessError('ERP-SALES-DELIVERY-EXCEEDS-RESERVATION', { reason: 'delivery qty 8 exceeds reserved_remaining 5' })
    expect(err.httpStatus).toBe(400)
    expect(err.en).toContain('8 exceeds reserved_remaining 5')
    expect(err.fa).toContain('رزروشده')
  })

  it('a parameterless code (not-found) renders both languages with no interpolation needed', () => {
    const err = businessError('ERP-GENERIC-NOT-FOUND', {})
    expect(err.httpStatus).toBe(404)
    expect(err.en).toBe('The requested resource was not found.')
    expect(err.fa).toBe('مورد درخواستی یافت نشد.')
  })
})

describe('toApiResponse', () => {
  it('shapes a NextResponse with the English message on `error` (backward compatible with existing clients) plus bilingual/code fields', async () => {
    const err = businessError('ERP-SALES-CREDIT-LIMIT-EXCEEDED', { limit: '1', projected: '2' })
    const res = toApiResponse(err)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe(err.en) // existing `res.error`/`crud.errorOf` readers keep working
    expect(body.error_fa).toBe(err.fa)
    expect(body.code).toBe('ERP-SALES-CREDIT-LIMIT-EXCEEDED')
    expect(body.severity).toBe('warning')
    expect(body.recoverable).toBe(true)
    // never leaks internal implementation detail
    expect(JSON.stringify(body)).not.toMatch(/stack|SELECT |INSERT |sql/i)
  })
})
