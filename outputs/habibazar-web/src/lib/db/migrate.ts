import path from 'path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getDb, pgQuery } from './index'

/**
 * Idempotent schema initialization for PostgreSQL.
 *
 *  1. Apply the Drizzle-generated migrations (the 58 ORM-modelled tables,
 *     `src/lib/db/schema.ts` → `drizzle/*.sql`).
 *  2. Create the raw-SQL-only tables that are not modelled by the ORM
 *     (system log stream, backup catalog, CRM leads, feature flags, assets) +
 *     their secondary indexes.
 *
 * Runs on server startup from `instrumentation.ts`.
 */
export async function runMigrations() {
  // 1) ORM tables via the Drizzle migrator
  await migrate(getDb(), { migrationsFolder: path.join(process.cwd(), 'drizzle') })

  // 2) raw-SQL-only tables (accessed via pgQuery, not the ORM)
  const NOW = "to_char(now(), 'YYYY-MM-DD HH24:MI:SS')"
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS crm_leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      source TEXT NOT NULL DEFAULT 'other' CHECK(source IN ('website','referral','consultation','contact_form','event','social','email','other')),
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','qualified','proposal','won','lost')),
      score INTEGER NOT NULL DEFAULT 0,
      value INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      owner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS feature_flags (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 0,
      rollout_percent INTEGER NOT NULL DEFAULT 100 CHECK(rollout_percent BETWEEN 0 AND 100),
      owner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS assets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other' CHECK(type IN ('server','network','firewall','switch','router','access_point','storage','vm','cloud','laptop','license','other')),
      serial TEXT,
      vendor TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','maintenance','retired','spare')),
      location TEXT,
      assigned_to TEXT,
      purchase_date TEXT,
      warranty_expiry TEXT,
      notes TEXT,
      owner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id SERIAL PRIMARY KEY,
      ts TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      source TEXT,
      service TEXT,
      message TEXT NOT NULL,
      stacktrace TEXT,
      request_id TEXT,
      user_id TEXT,
      fingerprint TEXT,
      meta TEXT
    );

    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      env TEXT NOT NULL DEFAULT 'production',
      trigger TEXT NOT NULL,
      bucket TEXT,
      status TEXT NOT NULL DEFAULT 'started',
      size INTEGER NOT NULL DEFAULT 0,
      checksum TEXT,
      manifest TEXT,
      copies TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      verify_detail TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      started_at TEXT NOT NULL DEFAULT (${NOW}),
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_syslogs_ts ON system_logs(ts);
    CREATE INDEX IF NOT EXISTS idx_syslogs_level_ts ON system_logs(level, ts);
    CREATE INDEX IF NOT EXISTS idx_syslogs_source ON system_logs(source);
    CREATE INDEX IF NOT EXISTS idx_syslogs_fingerprint ON system_logs(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_backups_started ON backups(started_at);
    CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
    CREATE INDEX IF NOT EXISTS idx_assets_type_status ON assets(type, status);
    CREATE INDEX IF NOT EXISTS idx_assets_warranty ON assets(warranty_expiry);
  `)
}
