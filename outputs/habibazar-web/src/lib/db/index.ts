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

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return (getDb() as never)[prop as never]
  },
})

export { schema }
