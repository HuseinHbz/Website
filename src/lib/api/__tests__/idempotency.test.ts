/**
 * Phase 26.32 بند۳ — regressions for the double-submit guard.
 *
 * These lock the behaviour that the live test proved was missing: two concurrent
 * identical creates must produce exactly ONE row. The pure helpers are tested
 * directly so the policy is verifiable without timers or a database.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  canonicalize, requestFingerprint, idempotencyDecision, runOnce, resetIdempotency,
} from '../idempotency'

beforeEach(() => resetIdempotency())

describe('canonicalize', () => {
  it('is key-order independent', () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }))
  })
  it('ignores volatile fields so a double-click still fingerprints alike', () => {
    expect(canonicalize({ a: 1, createdAt: 'x' })).toBe(canonicalize({ a: 1, createdAt: 'y' }))
  })
  it('distinguishes genuinely different bodies', () => {
    expect(canonicalize({ a: 1 })).not.toBe(canonicalize({ a: 2 }))
  })
  it('handles nested objects and arrays', () => {
    expect(canonicalize({ x: [{ b: 1, a: 2 }] })).toBe(canonicalize({ x: [{ a: 2, b: 1 }] }))
  })
})

describe('requestFingerprint', () => {
  it('separates actors', () => {
    expect(requestFingerprint('u1', 'skills', { a: 1 })).not.toBe(requestFingerprint('u2', 'skills', { a: 1 }))
  })
  it('separates routes', () => {
    expect(requestFingerprint('u1', 'skills', { a: 1 })).not.toBe(requestFingerprint('u1', 'timeline', { a: 1 }))
  })
  it('is stable for the same submission', () => {
    expect(requestFingerprint('u1', 'skills', { a: 1, b: 2 })).toBe(requestFingerprint('u1', 'skills', { b: 2, a: 1 }))
  })
})

describe('idempotencyDecision', () => {
  it('proceeds when nothing was seen', () => {
    expect(idempotencyDecision(undefined, 1000)).toBe('proceed')
  })
  it('replays inside the window', () => {
    expect(idempotencyDecision(1000, 1500, 10_000)).toBe('replay')
  })
  it('proceeds again once the window has passed — a deliberate re-create is allowed', () => {
    expect(idempotencyDecision(1000, 20_000, 10_000)).toBe('proceed')
  })
})

describe('runOnce', () => {
  it('runs a concurrent duplicate exactly once (the defect 26.32 measured)', async () => {
    let calls = 0
    const create = async () => { calls++; await new Promise(r => setTimeout(r, 20)); return { id: calls } }
    const [a, b] = await Promise.all([
      runOnce('u1', 'skills', { name: 'X' }, create),
      runOnce('u1', 'skills', { name: 'X' }, create),
    ])
    expect(calls).toBe(1)
    expect(a).toEqual(b)
  })

  it('does not merge different bodies', async () => {
    let calls = 0
    const create = async () => { calls++; return { id: calls } }
    await Promise.all([
      runOnce('u1', 'skills', { name: 'X' }, create),
      runOnce('u1', 'skills', { name: 'Y' }, create),
    ])
    expect(calls).toBe(2)
  })

  it('does not merge across actors', async () => {
    let calls = 0
    const create = async () => { calls++; return { id: calls } }
    await Promise.all([
      runOnce('u1', 'skills', { name: 'X' }, create),
      runOnce('u2', 'skills', { name: 'X' }, create),
    ])
    expect(calls).toBe(2)
  })

  it('a failure is not cached — the user can retry immediately', async () => {
    let calls = 0
    const boom = async () => { calls++; throw new Error('db down') }
    await expect(runOnce('u1', 'skills', { n: 1 }, boom)).rejects.toThrow('db down')
    await expect(runOnce('u1', 'skills', { n: 1 }, boom)).rejects.toThrow('db down')
    expect(calls).toBe(2)
  })

  it('allows a deliberate identical re-create once the window expires', async () => {
    let calls = 0
    const create = async () => { calls++; return { id: calls } }
    await runOnce('u1', 'skills', { n: 1 }, create, 1)
    await new Promise(r => setTimeout(r, 10))
    await runOnce('u1', 'skills', { n: 1 }, create, 1)
    expect(calls).toBe(2)
  })
})
