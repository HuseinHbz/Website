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

    -- Enterprise Asset Management (Phase 21 ERP, Module 5) — extended fields.
    -- Idempotent ADD COLUMN so existing installs upgrade in place.
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS model TEXT;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS manufacturer TEXT;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS barcode TEXT;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_price NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS residual_value NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS useful_life_years NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS depreciation_method TEXT NOT NULL DEFAULT 'none';
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS insurance_policy TEXT;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS insurance_expiry TEXT;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS contract_ref TEXT;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS department TEXT;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS employee TEXT;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS cost_center TEXT;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS project TEXT;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS gps_lat NUMERIC;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS gps_lng NUMERIC;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS calibration_due TEXT;

    -- Assignment history (who/where an asset was assigned, over time).
    CREATE TABLE IF NOT EXISTS asset_assignments (
      id SERIAL PRIMARY KEY,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      assignee TEXT NOT NULL,
      department TEXT,
      location TEXT,
      from_date TEXT,
      to_date TEXT,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Maintenance + calibration schedule and history.
    CREATE TABLE IF NOT EXISTS asset_maintenance (
      id SERIAL PRIMARY KEY,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'maintenance' CHECK(type IN ('maintenance','calibration','repair','inspection')),
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','done','overdue','cancelled')),
      scheduled_date TEXT,
      done_date TEXT,
      cost NUMERIC NOT NULL DEFAULT 0,
      vendor TEXT,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Activity timeline / audit trail per asset.
    CREATE TABLE IF NOT EXISTS asset_activity (
      id SERIAL PRIMARY KEY,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      detail TEXT,
      user_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
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

    -- Enterprise Inventory (Phase 21 ERP, Module 4). Multi-warehouse stock with
    -- bin locations, lot/serial tracking, a full move ledger and FIFO/LIFO/WAVG
    -- valuation (computed by lib/erp/inventory.ts from the move history).
    CREATE TABLE IF NOT EXISTS inv_warehouses (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      branch TEXT,
      address TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS inv_locations (
      id SERIAL PRIMARY KEY,
      warehouse_id INTEGER NOT NULL REFERENCES inv_warehouses(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      rack TEXT,
      shelf TEXT,
      bin TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      UNIQUE (warehouse_id, code)
    );

    CREATE TABLE IF NOT EXISTS inv_products (
      id SERIAL PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      unit TEXT NOT NULL DEFAULT 'pcs',
      cost NUMERIC NOT NULL DEFAULT 0,
      price NUMERIC NOT NULL DEFAULT 0,
      track_lot INTEGER NOT NULL DEFAULT 0,
      track_serial INTEGER NOT NULL DEFAULT 0,
      valuation_method TEXT NOT NULL DEFAULT 'wavg' CHECK(valuation_method IN ('fifo','lifo','wavg')),
      reorder_point NUMERIC NOT NULL DEFAULT 0,
      min_stock NUMERIC NOT NULL DEFAULT 0,
      max_stock NUMERIC NOT NULL DEFAULT 0,
      safety_stock NUMERIC NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- One row per stock movement. qty is signed: >0 in, <0 out. A transfer is
    -- written as two rows (issue from source, receipt into destination) sharing a ref.
    CREATE TABLE IF NOT EXISTS inv_moves (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES inv_products(id) ON DELETE CASCADE,
      warehouse_id INTEGER NOT NULL REFERENCES inv_warehouses(id),
      location_id INTEGER REFERENCES inv_locations(id),
      type TEXT NOT NULL CHECK(type IN ('receipt','issue','transfer','adjustment','return','count')),
      qty NUMERIC NOT NULL,
      unit_cost NUMERIC NOT NULL DEFAULT 0,
      lot TEXT,
      serial TEXT,
      ref TEXT,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
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
    CREATE INDEX IF NOT EXISTS idx_inv_moves_product ON inv_moves(product_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_inv_moves_wh ON inv_moves(warehouse_id);
    CREATE INDEX IF NOT EXISTS idx_inv_products_category ON inv_products(category);
    CREATE INDEX IF NOT EXISTS idx_inv_locations_wh ON inv_locations(warehouse_id);
    CREATE INDEX IF NOT EXISTS idx_asset_assign_asset ON asset_assignments(asset_id, from_date);
    CREATE INDEX IF NOT EXISTS idx_asset_maint_asset ON asset_maintenance(asset_id, scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_asset_maint_status ON asset_maintenance(status);
    CREATE INDEX IF NOT EXISTS idx_asset_activity_asset ON asset_activity(asset_id, created_at);
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
