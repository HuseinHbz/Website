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
  // 1) ORM tables via the Drizzle migrator. On a database that was already
  //    provisioned (e.g. by an earlier deploy) whose migration ledger is out of
  //    sync, the migrator can throw "already exists"/"does not exist" while trying
  //    to (re)apply. The schema is present, so treat that as non-fatal and carry
  //    on — the raw-table step below is idempotent (CREATE TABLE IF NOT EXISTS).
  try {
    await migrate(getDb(), { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e)
    if (!/already exists|does not exist/i.test(msg)) throw e
    console.warn('[migrate] drizzle migrator skipped (schema already present):', msg.slice(0, 160))
  }

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

    -- Enterprise Workflow Designer (Phase 21): visual, script-less business
    -- workflows. The definition column is the node/edge graph (JSON), executed
    -- by the pure engine in lib/workflow/engine.ts. Versioned + status-gated.
    CREATE TABLE IF NOT EXISTS workflows (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      description TEXT,
      definition TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
      active INTEGER NOT NULL DEFAULT 1,
      owner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Execution history for each workflow run (status + log + variables).
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id SERIAL PRIMARY KEY,
      workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','waiting','failed')),
      trigger TEXT NOT NULL DEFAULT 'manual',
      input TEXT,
      variables TEXT,
      log TEXT,
      error TEXT,
      steps INTEGER NOT NULL DEFAULT 0,
      waiting_node TEXT,
      run_by TEXT REFERENCES users(id),
      started_at TEXT NOT NULL DEFAULT (${NOW}),
      finished_at TEXT
    );

    -- Prompt Center (Phase 22): named prompts with an immutable version history.
    -- ai_prompts is the current head (active version + status); ai_prompt_versions
    -- keeps every version for rollback/approval/audit.
    CREATE TABLE IF NOT EXISTS ai_prompts (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      description TEXT,
      current_version INTEGER NOT NULL DEFAULT 1,
      active_version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','archived')),
      owner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS ai_prompt_versions (
      id SERIAL PRIMARY KEY,
      prompt_id INTEGER NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      body TEXT NOT NULL,
      note TEXT,
      author_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE (prompt_id, version)
    );

    -- AI Platform telemetry (Phase 22): one row per completion run through the
    -- shared engine (chat + agents). Powers the AI Analytics dashboard.
    CREATE TABLE IF NOT EXISTS ai_usage (
      id SERIAL PRIMARY KEY,
      ts TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT,
      source TEXT NOT NULL DEFAULT 'chat',
      latency_ms INTEGER NOT NULL DEFAULT 0,
      success INTEGER NOT NULL DEFAULT 1,
      error TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      rag_sources INTEGER NOT NULL DEFAULT 0,
      feedback INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_syslogs_ts ON system_logs(ts);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_ts ON ai_usage(ts);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_source ON ai_usage(source);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage(provider);
    CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_pid ON ai_prompt_versions(prompt_id, version);
    CREATE INDEX IF NOT EXISTS idx_ai_prompts_category ON ai_prompts(category);
    CREATE INDEX IF NOT EXISTS idx_syslogs_level_ts ON system_logs(level, ts);
    CREATE INDEX IF NOT EXISTS idx_syslogs_source ON system_logs(source);
    CREATE INDEX IF NOT EXISTS idx_syslogs_fingerprint ON system_logs(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_backups_started ON backups(started_at);
    CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
    CREATE INDEX IF NOT EXISTS idx_assets_type_status ON assets(type, status);
    CREATE INDEX IF NOT EXISTS idx_assets_warranty ON assets(warranty_expiry);
    CREATE INDEX IF NOT EXISTS idx_wf_runs_wf ON workflow_runs(workflow_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_wf_status ON workflows(status);
  `)
}
