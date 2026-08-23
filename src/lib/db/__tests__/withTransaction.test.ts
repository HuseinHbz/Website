import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withTransaction } from '../index'

// Full-remediation P0-1: pgQuery('BEGIN') followed by more pgQuery(...) calls
// is NOT a real transaction, because Pool.query() acquires+releases a
// connection per call. withTransaction() must hold ONE dedicated connection
// for BEGIN -> fn -> COMMIT/ROLLBACK -> release, every time, regardless of
// success or failure. `withTransaction`'s pool param is injectable for
// exactly this kind of control-flow test — no real database involved.

function fakePool(queryImpl: (text: string) => Promise<{ rows: unknown[] }>) {
  const client = { query: vi.fn(queryImpl), release: vi.fn() }
  const pool = { connect: vi.fn(async () => client) }
  return { pool, client }
}

describe('withTransaction', () => {
  beforeEach(() => {})

  it('runs BEGIN, the callback (on the SAME connection), then COMMIT, then releases', async () => {
    const calls: string[] = []
    const { pool, client } = fakePool(async text => { calls.push(text); return { rows: [{ id: 1 }] } })

    const result = await withTransaction(async query => {
      const rows = await query<{ id: number }>('INSERT INTO x VALUES ($1) RETURNING id', [1])
      return rows[0].id
    }, pool)

    expect(result).toBe(1)
    expect(pool.connect).toHaveBeenCalledTimes(1) // ONE connection for the whole transaction
    expect(calls[0]).toBe('BEGIN')
    expect(calls[1]).toBe('INSERT INTO x VALUES ($1) RETURNING id')
    expect(calls[2]).toBe('COMMIT')
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('rolls back fully and rethrows when the callback throws mid-transaction — no partial write survives', async () => {
    const calls: string[] = []
    const { pool, client } = fakePool(async text => { calls.push(text); return { rows: [] } })

    await expect(withTransaction(async query => {
      await query('INSERT INTO x VALUES (1)')
      throw new Error('simulated mid-transaction failure')
    }, pool)).rejects.toThrow('simulated mid-transaction failure')

    expect(calls[0]).toBe('BEGIN')
    expect(calls[1]).toBe('INSERT INTO x VALUES (1)')
    expect(calls).toContain('ROLLBACK')
    expect(calls).not.toContain('COMMIT') // never commits a failed transaction
    expect(client.release).toHaveBeenCalledTimes(1) // connection always returned to the pool
  })

  it('releases the connection even if ROLLBACK itself throws', async () => {
    const { pool, client } = fakePool(async text => {
      if (text === 'ROLLBACK') throw new Error('rollback failed')
      if (text === 'BEGIN') return { rows: [] }
      throw new Error('boom')
    })

    await expect(withTransaction(async query => { await query('X'); return 1 }, pool)).rejects.toThrow()
    expect(client.release).toHaveBeenCalledTimes(1)
  })
})
