import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tryAcquireUploadSlot, releaseUploadSlot, activeUploadCount, maxConcurrentUploads, __resetForTests } from '../concurrency'

describe('upload concurrency guard', () => {
  beforeEach(() => { __resetForTests(); vi.unstubAllEnvs() })

  it('allows acquiring slots up to the configured maximum', () => {
    vi.stubEnv('MEDIA_MAX_CONCURRENT_UPLOADS', '3')
    expect(tryAcquireUploadSlot()).toBe(true)
    expect(tryAcquireUploadSlot()).toBe(true)
    expect(tryAcquireUploadSlot()).toBe(true)
    expect(activeUploadCount()).toBe(3)
  })

  it('rejects the (max+1)th concurrent acquire', () => {
    vi.stubEnv('MEDIA_MAX_CONCURRENT_UPLOADS', '2')
    expect(tryAcquireUploadSlot()).toBe(true)
    expect(tryAcquireUploadSlot()).toBe(true)
    expect(tryAcquireUploadSlot()).toBe(false)
    expect(activeUploadCount()).toBe(2) // the rejected attempt reserved nothing
  })

  it('releasing a slot allows a new acquire to succeed', () => {
    vi.stubEnv('MEDIA_MAX_CONCURRENT_UPLOADS', '1')
    expect(tryAcquireUploadSlot()).toBe(true)
    expect(tryAcquireUploadSlot()).toBe(false)
    releaseUploadSlot()
    expect(tryAcquireUploadSlot()).toBe(true)
  })

  it('never goes negative on an extra release (defensive floor at 0)', () => {
    releaseUploadSlot()
    releaseUploadSlot()
    expect(activeUploadCount()).toBe(0)
  })

  it('defaults to 6 when the env var is unset or invalid', () => {
    vi.stubEnv('MEDIA_MAX_CONCURRENT_UPLOADS', '')
    expect(maxConcurrentUploads()).toBe(6)
    vi.stubEnv('MEDIA_MAX_CONCURRENT_UPLOADS', 'not-a-number')
    expect(maxConcurrentUploads()).toBe(6)
  })
})
