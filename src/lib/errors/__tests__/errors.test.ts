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
