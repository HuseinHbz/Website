import { describe, it, expect, vi } from 'vitest'
import { apiErrorFa, newRequestId, logFa } from '../errorContract'

describe('newRequestId', () => {
  it('produces a unique id on every call', () => {
    const ids = new Set(Array.from({ length: 20 }, () => newRequestId()))
    expect(ids.size).toBe(20)
  })
})

describe('apiErrorFa', () => {
  it('builds the exact contract shape with the given status', async () => {
    const res = apiErrorFa(413, 'MEDIA_SIZE_EXCEEDED', 'حجم ویدیو بیشتر از حد مجاز ۵۰ مگابایت است.')
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.errorCode).toBe('MEDIA_SIZE_EXCEEDED')
    expect(body.messageFa).toBe('حجم ویدیو بیشتر از حد مجاز ۵۰ مگابایت است.')
    expect(body.requestId).toBeTruthy()
  })

  it('includes stage/fieldErrors/retryable when provided', async () => {
    const res = apiErrorFa(422, 'MEDIA_INVALID_NAME', 'نام نامعتبر است.', {
      stage: 'validation', fieldErrors: { nameEn: 'نام انگلیسی الزامی است' }, retryable: true,
    })
    const body = await res.json()
    expect(body.stage).toBe('validation')
    expect(body.fieldErrors).toEqual({ nameEn: 'نام انگلیسی الزامی است' })
    expect(body.retryable).toBe(true)
  })

  it('reuses a caller-supplied requestId instead of generating a new one', async () => {
    const res = apiErrorFa(500, 'MEDIA_DATABASE_WRITE_FAILED', 'خطا', { requestId: 'fixed-id-123' })
    const body = await res.json()
    expect(body.requestId).toBe('fixed-id-123')
  })

  it('never leaks a stack trace or raw error into the response body', async () => {
    const res = apiErrorFa(500, 'MEDIA_WRITE_FAILED', 'خطای داخلی رخ داد.')
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('at ')
    expect(JSON.stringify(body)).not.toContain('.ts:')
  })
})

describe('logFa', () => {
  it('logs a structured line with the Persian event/status and the real cause, never sent to client', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logFa('آپلود ویدیوی پس‌زمینه', 'MEDIA_DATABASE_WRITE_FAILED', 'فایل ذخیره شد اما ثبت اطلاعات آن در پایگاه داده ناموفق بود.', 'req-1', new Error('ECONNREFUSED 127.0.0.1:5432'))
    expect(spy).toHaveBeenCalledTimes(1)
    const logged = JSON.parse(spy.mock.calls[0][0] as string)
    expect(logged.event).toBe('آپلود ویدیوی پس‌زمینه')
    expect(logged.status).toBe('ناموفق')
    expect(logged.errorCode).toBe('MEDIA_DATABASE_WRITE_FAILED')
    expect(logged.cause).toContain('ECONNREFUSED')
    spy.mockRestore()
  })
})
