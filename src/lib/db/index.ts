import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://habibazar:habibazar_local@127.0.0.1:5432/habibazar'

let _pool: Pool | null = null
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
    _pool.on('error', (err) => {
      // background pool errors must not crash the process
      console.error('[pg] idle client error:', err.message)
    })
  }
  return _pool
}

export function getDb() {
  if (!_db) _db = drizzle(getPool(), { schema })
  return _db
}

/**
 * Raw parameterized SQL against the pool (async). Replaces the old
 * former synchronous raw-DB access pattern.
 * Returns the rows array; use rows[0] for a single row.
 */
export async function pgQuery<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query(text, params as never[])
  return res.rows as T[]
}

/**
 * Run `fn` inside a REAL database transaction on a single dedicated
 * connection (BEGIN → fn → COMMIT, ROLLBACK on any throw, connection always
 * released). Full-remediation P0-1: `pgQuery('BEGIN')` followed by more
 * `pgQuery(...)` calls is NOT a transaction — `Pool.query()` acquires and
 * releases a pooled connection per call, so under concurrency the later
 * statements can land on a different connection than the one that ran
 * BEGIN, silently losing atomicity. `fn` receives a `TxQuery` bound to the
 * one connection held for the whole transaction; use it instead of the
 * shared-pool `pgQuery` for every statement inside the callback.
 */
export type TxQuery = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>

/** `pool` is injectable for unit-testing the BEGIN/COMMIT/ROLLBACK/release
 *  control flow without a real database; production call sites never pass
 *  it and get the real pool. */
export async function withTransaction<T>(
  fn: (query: TxQuery) => Promise<T>,
  pool: Pick<Pool, 'connect'> = getPool(),
): Promise<T> {
  const client = await pool.connect()
  const query: TxQuery = async (text, params = []) => {
    const res = await client.query(text, params as never[])
    return res.rows as never[]
  }
  try {
    await client.query('BEGIN')
    const result = await fn(query)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return (getDb() as never)[prop as never]
  },
})

export { schema }
