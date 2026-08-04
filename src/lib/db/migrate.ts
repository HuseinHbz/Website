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

    -- 26.23: CRM operational layer — activities timeline + lead→customer link.
    CREATE TABLE IF NOT EXISTS crm_activities (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'note' CHECK(kind IN ('call','meeting','email','note','task')),
      body TEXT NOT NULL,
      due_at TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      assigned_to TEXT REFERENCES users(id),
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON crm_activities(lead_id);
    ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS converted_customer_id INTEGER;







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

    -- Enterprise Integration Hub (Phase 21.8). Connectors + a dispatch log that
    -- doubles as the dead-letter queue (status 'dead' after retries exhausted).
    --
    -- 26.32 NAME COLLISION (found by audit:modules): this table used to be named
    -- "integrations" -- the same name the Drizzle schema uses for the CMS
    -- Integrations Catalog (slug/name_en/category). The Drizzle migrator runs
    -- first, so CREATE TABLE IF NOT EXISTS here NEVER fired and every Hub query
    -- hit the CMS table (column i.key does not exist) so the whole module 500'd.
    -- Renamed to integration_connectors; the dispatch FK moves with it.
    -- Both tables were empty, so nothing is lost.
    CREATE TABLE IF NOT EXISTS integration_connectors (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('rest','graphql','webhook','smtp','kafka','rabbitmq','sftp')),
      config TEXT NOT NULL DEFAULT '{}',
      active INTEGER NOT NULL DEFAULT 1,
      retries INTEGER NOT NULL DEFAULT 2,
      owner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS integration_dispatches (
      id SERIAL PRIMARY KEY,
      connector_id INTEGER NOT NULL REFERENCES integration_connectors(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'success' CHECK(status IN ('success','failed','queued','dead')),
      request TEXT,
      response TEXT,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 1,
      error TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Business Rules Engine (Phase 21.7). Versioned decision tables evaluated by
    -- lib/rules/engine.ts; head (current + active version + status) × immutable
    -- version history for rollback. Workflows call rules via the handler seam.
    CREATE TABLE IF NOT EXISTS business_rules (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      description TEXT,
      current_version INTEGER NOT NULL DEFAULT 1,
      active_version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
      owner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS business_rule_versions (
      id SERIAL PRIMARY KEY,
      rule_id INTEGER NOT NULL REFERENCES business_rules(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      definition TEXT NOT NULL DEFAULT '{}',
      note TEXT,
      author_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE (rule_id, version)
    );

    -- Enterprise Numbering Engine (Phase 21.11). The single source of truth for
    -- document numbers across every module. A reusable *format* per document type
    -- (pattern with placeholders + reset policy + counter rules), an atomic
    -- *counter* per (format, scope, period) — scope keys give multi-company/
    -- branch/warehouse independence, period keys drive automatic resets — and an
    -- append-only *audit* of every generated/reserved number. Generation is
    -- concurrency-safe via a transactional INSERT … ON CONFLICT … RETURNING on the
    -- counter (backed by a per-scope advisory lock). No module numbers on its own.
    CREATE TABLE IF NOT EXISTS numbering_formats (
      id SERIAL PRIMARY KEY,
      doc_type TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      pattern TEXT NOT NULL DEFAULT '{PREFIX}-{YEAR}-{COUNTER}',
      prefix TEXT NOT NULL DEFAULT '',
      suffix TEXT NOT NULL DEFAULT '',
      reset_policy TEXT NOT NULL DEFAULT 'yearly' CHECK(reset_policy IN ('never','daily','weekly','monthly','quarterly','yearly','fiscal')),
      padding INTEGER NOT NULL DEFAULT 6,
      increment INTEGER NOT NULL DEFAULT 1,
      start_number INTEGER NOT NULL DEFAULT 1,
      min_number INTEGER NOT NULL DEFAULT 1,
      max_number BIGINT,
      alphabet TEXT NOT NULL DEFAULT 'numeric' CHECK(alphabet IN ('numeric','hex')),
      fiscal_start_month INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS numbering_counters (
      id SERIAL PRIMARY KEY,
      format_id INTEGER NOT NULL REFERENCES numbering_formats(id) ON DELETE CASCADE,
      scope_key TEXT NOT NULL DEFAULT '',
      period_key TEXT NOT NULL DEFAULT '',
      current_value BIGINT NOT NULL DEFAULT 0,
      last_number TEXT,
      updated_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE (format_id, scope_key, period_key)
    );

    CREATE TABLE IF NOT EXISTS numbering_audit (
      id SERIAL PRIMARY KEY,
      format_id INTEGER REFERENCES numbering_formats(id) ON DELETE SET NULL,
      doc_type TEXT NOT NULL,
      number TEXT NOT NULL,
      scope_key TEXT NOT NULL DEFAULT '',
      period_key TEXT NOT NULL DEFAULT '',
      counter_value BIGINT,
      module TEXT,
      source TEXT NOT NULL DEFAULT 'api',
      status TEXT NOT NULL DEFAULT 'generated' CHECK(status IN ('generated','reserved','released','failed')),
      user_id TEXT REFERENCES users(id),
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_numbering_audit_type ON numbering_audit(doc_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_numbering_audit_number ON numbering_audit(number);
    CREATE INDEX IF NOT EXISTS idx_numbering_counters_fmt ON numbering_counters(format_id);
    -- {RANDOM} auto-fill length (0 = off); added idempotently for existing DBs.
    ALTER TABLE numbering_formats ADD COLUMN IF NOT EXISTS random_length INTEGER NOT NULL DEFAULT 4;

    -- Role default dashboard layouts (Phase 22.2 patch). Resolution priority:
    -- user → department → role → workspace default.
    CREATE TABLE IF NOT EXISTS dashboard_role_layouts (
      id SERIAL PRIMARY KEY,
      role TEXT NOT NULL,
      workspace TEXT NOT NULL,
      layout TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE (role, workspace)
    );

    -- Department/team assignment (Phase 22.2 completion). Added idempotently.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;

    -- Department default dashboard layouts.
    CREATE TABLE IF NOT EXISTS dashboard_dept_layouts (
      id SERIAL PRIMARY KEY,
      department TEXT NOT NULL,
      workspace TEXT NOT NULL,
      layout TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE (department, workspace)
    );

    -- Reusable dashboard templates (create / clone / apply).
    CREATE TABLE IF NOT EXISTS dashboard_templates (
      id SERIAL PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      workspace TEXT NOT NULL,
      layout TEXT NOT NULL DEFAULT '[]',
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_dashboard_templates_ws ON dashboard_templates(workspace);

    -- Dashboard sharing: an owner publishes a layout snapshot to a target
    -- (user/role/department) at a permission level. Self-contained (stores the
    -- layout), so applying a share never entangles the resolver.
    CREATE TABLE IF NOT EXISTS dashboard_shares (
      id SERIAL PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('user','role','department')),
      target_key TEXT NOT NULL,
      permission TEXT NOT NULL DEFAULT 'view' CHECK(permission IN ('view','edit','manage')),
      layout TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE (owner_id, workspace, target_type, target_key)
    );
    CREATE INDEX IF NOT EXISTS idx_dashboard_shares_target ON dashboard_shares(target_type, target_key);

    -- Per-user navigation preferences (Phase 22.3): pinned favorites + recent
    -- items (each a JSON array of hrefs / {href,ts}). One row per user.
    CREATE TABLE IF NOT EXISTS nav_prefs (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      favorites TEXT NOT NULL DEFAULT '[]',
      recents TEXT NOT NULL DEFAULT '[]',
      searches TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    ALTER TABLE nav_prefs ADD COLUMN IF NOT EXISTS searches TEXT NOT NULL DEFAULT '[]';
    -- Persisted per-user nav UI state (collapsed sidebar groups). Phase 22.3 completion.
    ALTER TABLE nav_prefs ADD COLUMN IF NOT EXISTS ui TEXT NOT NULL DEFAULT '{}';
    -- Executed-command history (Phase 22.4): recent command ids run from the palette.
    ALTER TABLE nav_prefs ADD COLUMN IF NOT EXISTS commands TEXT NOT NULL DEFAULT '[]';

    -- Popular searches aggregate (Phase 22.4). Cross-user term frequency powering
    -- the palette's "Popular" suggestions; incremented atomically on each search.
    CREATE TABLE IF NOT EXISTS search_stats (
      term TEXT PRIMARY KEY,
      hits INTEGER NOT NULL DEFAULT 0,
      last_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Enterprise DataTable Platform: per-user column layout per table (column
    -- order/width/visibility/pin + density/pageSize), one row per (user, table).
    CREATE TABLE IF NOT EXISTS table_prefs (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      table_id TEXT NOT NULL,
      prefs TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (${NOW}),
      PRIMARY KEY (user_id, table_id)
    );
    -- Named saved views (full view state JSON). Owner-scoped; optionally shared to
    -- a role or department (RBAC visibility) or globally. is_default marks the
    -- owner's auto-applied view for that table.
    CREATE TABLE IF NOT EXISTS table_views (
      id SERIAL PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      table_id TEXT NOT NULL,
      name TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT '{}',
      shared_scope TEXT NOT NULL DEFAULT 'private',
      shared_key TEXT,
      is_default BOOLEAN NOT NULL DEFAULT false,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_table_views_table ON table_views(table_id);
    CREATE INDEX IF NOT EXISTS idx_table_views_owner ON table_views(owner_id, table_id);

    -- ── Enterprise Hero Platform (Phase 23) ────────────────────────────────
    -- Versioned, template-driven landing experiences. The config column holds the
    -- full editable hero JSON (per-language content + style + blocks). Distinct
    -- from the legacy hero_content/hero_variant (kept intact for the current home).
    CREATE TABLE IF NOT EXISTS heroes (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      template TEXT NOT NULL,
      category TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      config TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      target_path TEXT,
      author_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW}),
      published_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_heroes_status ON heroes(status);
    CREATE INDEX IF NOT EXISTS idx_heroes_target ON heroes(target_path);
    -- Immutable version history (rollback / compare / audit trail).
    CREATE TABLE IF NOT EXISTS hero_versions (
      id SERIAL PRIMARY KEY,
      hero_id INTEGER NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      config TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      author_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hero_versions_hero ON hero_versions(hero_id, version DESC);
    -- A/B experiments (variants + weights + lifecycle).
    CREATE TABLE IF NOT EXISTS hero_experiments (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      target_path TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      variants TEXT NOT NULL DEFAULT '[]',
      winner TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    -- Personalization targeting rules (device/lang/country/returning/campaign/…).
    CREATE TABLE IF NOT EXISTS hero_rules (
      id SERIAL PRIMARY KEY,
      hero_id INTEGER NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
      target_path TEXT,
      priority INTEGER NOT NULL DEFAULT 0,
      match TEXT NOT NULL DEFAULT '{}',
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hero_rules_target ON hero_rules(target_path, active);
    -- Analytics events (view/click/conversion/scroll/time) — append-only.
    CREATE TABLE IF NOT EXISTS hero_events (
      id BIGSERIAL PRIMARY KEY,
      hero_id INTEGER NOT NULL,
      experiment_key TEXT,
      variant_id TEXT,
      type TEXT NOT NULL,
      value REAL,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hero_events_hero ON hero_events(hero_id, type);
    CREATE INDEX IF NOT EXISTS idx_hero_events_exp ON hero_events(experiment_key);

    -- Phase 25.2: Animation Library CMS (custom/managed presets on top of the
    -- built-in registry) + versioning + collections.
    CREATE TABLE IF NOT EXISTS hero_collections (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',   -- private | organization
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS hero_animation_presets (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'entrance',
      base_preset TEXT,                              -- built-in preset it derives from
      config TEXT NOT NULL DEFAULT '{}',             -- HeroAnimation JSON (timing/easing/…)
      tags TEXT NOT NULL DEFAULT '[]',
      collection_id INTEGER,
      enabled BOOLEAN NOT NULL DEFAULT true,
      archived BOOLEAN NOT NULL DEFAULT false,
      favorite BOOLEAN NOT NULL DEFAULT false,
      usage_count INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS hero_animation_versions (
      id BIGSERIAL PRIMARY KEY,
      preset_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      config TEXT NOT NULL,
      note TEXT,
      author_id TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hanim_category ON hero_animation_presets(category, archived);
    CREATE INDEX IF NOT EXISTS idx_hanim_collection ON hero_animation_presets(collection_id);
    CREATE INDEX IF NOT EXISTS idx_hanim_favorite ON hero_animation_presets(favorite) WHERE favorite = true;
    CREATE INDEX IF NOT EXISTS idx_hanim_versions_pid ON hero_animation_versions(preset_id, version DESC);

    -- Per-user dashboard layouts (Phase 22.2). One saved widget layout per
    -- (user, workspace); absent → the system default layout is used.
    CREATE TABLE IF NOT EXISTS dashboard_layouts (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace TEXT NOT NULL,
      layout TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE (user_id, workspace)
    );

    -- Numbering scopes: the registry of companies/branches/warehouses/departments
    -- whose codes feed a counter's scope_key (multi-company/branch/warehouse
    -- independence). Managed in the numbering console; picked when generating.
    CREATE TABLE IF NOT EXISTS numbering_scopes (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('company','branch','warehouse','department')),
      code TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE (kind, code)
    );

    -- Default numbering formats for the built-in document types so every module
    -- has a series out of the box (idempotent; admins can edit these). Sales use
    -- their own keys; generated documents are namespaced doc_* to stay independent.
    INSERT INTO numbering_formats (doc_type, name_en, name_fa, pattern, prefix, reset_policy, padding, start_number) VALUES
      ('invoice','Sales Invoice','فاکتور فروش','{PREFIX}-{YEAR}-{COUNTER}','INV','yearly',6,1),
      ('quote','Quotation','پیش‌فاکتور','{PREFIX}-{YEAR}-{COUNTER}','QT','yearly',6,1),
      ('order','Sales Order','سفارش فروش','{PREFIX}-{YEAR}-{COUNTER}','SO','yearly',6,1),
      ('credit_note','Credit Note','برگ بستانکار','{PREFIX}-{YEAR}-{COUNTER}','CN','yearly',6,1),
      ('project','Project','پروژه','{PREFIX}-{YEAR}-{COUNTER}','PRJ','yearly',4,1),
      ('doc_invoice','Document · Invoice','سند · فاکتور','{PREFIX}-{YEAR}-{COUNTER}','INV','yearly',6,1),
      ('doc_quotation','Document · Quotation','سند · پیش‌فاکتور','{PREFIX}-{YEAR}-{COUNTER}','QT','yearly',6,1),
      ('doc_purchase_order','Document · Purchase Order','سند · سفارش خرید','{PREFIX}-{YEAR}-{COUNTER}','PO','yearly',6,1),
      ('doc_contract','Document · Contract','سند · قرارداد','{PREFIX}-{YEAR}-{COUNTER}','CT','yearly',6,1),
      ('doc_proposal','Document · Proposal','سند · پروپوزال','{PREFIX}-{YEAR}-{COUNTER}','PR','yearly',6,1),
      ('doc_warranty','Document · Warranty','سند · گارانتی','{PREFIX}-{YEAR}-{COUNTER}','WR','yearly',6,1),
      ('doc_delivery_note','Document · Delivery Note','سند · حواله تحویل','{PREFIX}-{YEAR}-{COUNTER}','DN','yearly',6,1),
      ('doc_service_report','Document · Service Report','سند · گزارش خدمات','{PREFIX}-{YEAR}-{COUNTER}','SR','yearly',6,1),
      ('doc_completion_certificate','Document · Completion Certificate','سند · گواهی تکمیل','{PREFIX}-{YEAR}-{COUNTER}','CC','yearly',6,1),
      ('doc_financial_report','Document · Financial Report','سند · گزارش مالی','{PREFIX}-{YEAR}-{COUNTER}','FR','yearly',6,1),
      ('journal','Journal Entry','سند حسابداری','{PREFIX}-{YEAR}-{COUNTER}','JE','yearly',5,1),
      ('ticket','Support Ticket','تیکت پشتیبانی','{PREFIX}-{YEAR}-{COUNTER}','TK','yearly',5,1)
    ON CONFLICT (doc_type) DO NOTHING;

    -- Document Generation Engine (Phase 21.5, Module 8). Catalog of generated
    -- documents (invoice/quotation/PO/contract/…); payload holds lines + meta +
    -- body; verify_code backs public QR verification.
    CREATE TABLE IF NOT EXISTS gen_documents (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      party_name TEXT,
      party_info TEXT,
      date TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      source_type TEXT,
      source_id INTEGER,
      verify_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','void')),
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    ALTER TABLE gen_documents ADD COLUMN IF NOT EXISTS template_key TEXT;

    -- Phase 26: Invoice Designer templates (presentation config per variant —
    -- official/unofficial/tax/retail/service/... — applied at render time).
    CREATE TABLE IF NOT EXISTS doc_templates (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      doc_type TEXT,
      config TEXT NOT NULL DEFAULT '{}',
      active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    INSERT INTO doc_templates (key, name_en, name_fa, doc_type, config) VALUES
      ('official-invoice','Official Invoice','فاکتور رسمی','invoice','{"variant":"Official","showLogo":true,"showSeal":true,"showSignature":true,"showQr":true}'),
      ('unofficial-invoice','Unofficial Invoice','فاکتور غیررسمی','invoice','{"variant":"Unofficial","watermarkText":"UNOFFICIAL","showLogo":true,"showSeal":false,"showSignature":true,"showQr":true}'),
      ('tax-invoice','Tax Invoice','فاکتور مالیاتی','invoice','{"variant":"Tax Invoice","showLogo":true,"showSeal":true,"showSignature":true,"showQr":true}'),
      ('service-invoice','Service Invoice','فاکتور خدمات','invoice','{"variant":"Service","showLogo":true,"showSeal":false,"showSignature":true,"showQr":true}'),
      -- Phase 26.7: Enterprise Invoice Template Center — 20 curated templates
      -- across Professional / Corporate / Minimal / Retail / International /
      -- Iranian-Accounting categories (idempotent seed; designer-editable).
      ('pro-classic','Professional Classic','حرفه‌ای کلاسیک','invoice','{"variant": "Professional", "accentColor": "#1e3a8a", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true}'),
      ('pro-modern','Professional Modern','حرفه‌ای مدرن','invoice','{"variant": "Professional", "accentColor": "#0f766e", "showLogo": true, "showSignature": true, "showQr": true, "showBarcode": true}'),
      ('pro-detailed','Professional Detailed','حرفه‌ای تفصیلی','invoice','{"variant": "Professional", "accentColor": "#334155", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "terms": "Payment due within 30 days of the invoice date."}'),
      ('pro-service','Professional Service','حرفه‌ای خدمات','invoice','{"variant": "Service", "accentColor": "#4f46e5", "showLogo": true, "showSignature": true, "showQr": true}'),
      ('corp-executive','Corporate Executive','سازمانی مدیریتی','invoice','{"variant": "Corporate", "accentColor": "#111827", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "footerNote": "This document is issued electronically and is valid without a handwritten signature."}'),
      ('corp-blue','Corporate Blue','سازمانی آبی','invoice','{"variant": "Corporate", "accentColor": "#1d4ed8", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true}'),
      ('corp-contract','Corporate Contract Billing','سازمانی قراردادی','invoice','{"variant": "Contract Billing", "accentColor": "#155e75", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "paymentInstructions": "Bank transfer to the account below; quote the invoice number as the payment reference."}'),
      ('corp-proforma','Corporate Pro-forma','سازمانی پیش‌فاکتور','invoice','{"variant": "Pro-forma", "accentColor": "#7c3aed", "watermarkText": "PRO-FORMA", "showLogo": true, "showSignature": true, "showQr": true}'),
      ('min-clean','Minimal Clean','مینیمال ساده','invoice','{"variant": "Minimal", "accentColor": "#404040", "showLogo": false, "showSeal": false, "showSignature": true, "showQr": true}'),
      ('min-mono','Minimal Mono','مینیمال تک‌رنگ','invoice','{"variant": "Minimal", "accentColor": "#171717", "showLogo": false, "showSeal": false, "showSignature": false, "showQr": true}'),
      ('min-compact','Minimal Compact','مینیمال فشرده','invoice','{"variant": "Compact", "accentColor": "#525252", "showLogo": true, "showSeal": false, "showSignature": false, "showQr": false, "showBarcode": true}'),
      ('retail-pos','Retail POS','خرده‌فروشی صندوق','invoice','{"variant": "Retail", "accentColor": "#dc2626", "showLogo": true, "showSeal": false, "showSignature": false, "showQr": true, "showBarcode": true}'),
      ('retail-store','Retail Store','خرده‌فروشی فروشگاهی','invoice','{"variant": "Retail", "accentColor": "#ea580c", "showLogo": true, "showSignature": false, "showQr": true, "showBarcode": true, "footerNote": "Goods may be exchanged within 7 days with this receipt."}'),
      ('retail-online','Retail Online Order','خرده‌فروشی آنلاین','invoice','{"variant": "Online Order", "accentColor": "#db2777", "showLogo": true, "showSignature": false, "showQr": true, "showBarcode": true}'),
      ('intl-export','International Export','بین‌المللی صادراتی','invoice','{"variant": "Export Invoice", "accentColor": "#0369a1", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "terms": "Incoterms and governing law as agreed in the underlying contract."}'),
      ('intl-usd','International (USD)','بین‌المللی دلاری','invoice','{"variant": "Commercial Invoice", "accentColor": "#047857", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "paymentInstructions": "SWIFT transfer to the account below. All bank charges are on the buyer."}'),
      ('intl-eur','International (EUR)','بین‌المللی یورویی','invoice','{"variant": "Commercial Invoice", "accentColor": "#4338ca", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true}'),
      ('ir-official','Iranian Official (رسمی)','رسمی ایرانی','invoice','{"variant": "فاکتور رسمی", "accentColor": "#166534", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "terms": "این صورتحساب مطابق نمونه سازمان امور مالیاتی صادر شده است."}'),
      ('ir-tax','Iranian VAT (مالیاتی)','مالیاتی ایرانی','invoice','{"variant": "صورتحساب مالیاتی", "accentColor": "#0d9488", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "showBarcode": true}'),
      ('ir-unofficial','Iranian Unofficial (غیررسمی)','غیررسمی ایرانی','invoice','{"variant": "غیررسمی", "accentColor": "#57534e", "watermarkText": "غیر رسمی", "showLogo": true, "showSeal": false, "showSignature": true, "showQr": true}')
    ON CONFLICT (key) DO NOTHING;

    -- Phase 26.10: 20 Persian (RTL) invoice templates.
    INSERT INTO doc_templates (key, name_en, name_fa, doc_type, config) VALUES
      ('fa-official','Iranian Official','فاکتور رسمی','invoice','{"variant": "فاکتور رسمی", "accentColor": "#166534", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "terms": "این صورتحساب مطابق ماده ۱۹ قانون مالیات بر ارزش افزوده صادر شده است.", "rtl": true}'),
      ('fa-tax','Iranian Tax','فاکتور مالیاتی','invoice','{"variant": "صورتحساب مالیاتی", "accentColor": "#0d9488", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "showBarcode": true, "rtl": true}'),
      ('fa-unofficial','Iranian Unofficial','فاکتور غیررسمی','invoice','{"variant": "غیررسمی", "accentColor": "#57534e", "watermarkText": "غیر رسمی", "showLogo": true, "showSignature": true, "showQr": true, "rtl": true}'),
      ('fa-proforma','Iranian Pro-forma','پیش‌فاکتور','invoice','{"variant": "پیش‌فاکتور", "accentColor": "#7c3aed", "watermarkText": "پیش‌فاکتور", "showLogo": true, "showSignature": true, "showQr": true, "rtl": true}'),
      ('fa-service','Iranian Service','فاکتور خدمات','invoice','{"variant": "خدمات", "accentColor": "#4f46e5", "showLogo": true, "showSignature": true, "showQr": true, "rtl": true}'),
      ('fa-retail','Iranian Retail','فاکتور فروشگاهی','invoice','{"variant": "خرده‌فروشی", "accentColor": "#dc2626", "showLogo": true, "showQr": true, "showBarcode": true, "footerNote": "کالای فروخته‌شده تا ۷ روز با ارائه فاکتور قابل تعویض است.", "rtl": true}'),
      ('fa-corporate','Iranian Corporate','فاکتور سازمانی','invoice','{"variant": "سازمانی", "accentColor": "#111827", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "rtl": true}'),
      ('fa-blue','Iranian Blue','فاکتور آبی','invoice','{"variant": "رسمی", "accentColor": "#1d4ed8", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "rtl": true}'),
      ('fa-green','Iranian Green','فاکتور سبز','invoice','{"variant": "رسمی", "accentColor": "#15803d", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "rtl": true}'),
      ('fa-minimal','Iranian Minimal','فاکتور مینیمال','invoice','{"variant": "ساده", "accentColor": "#404040", "showSignature": true, "showQr": true, "rtl": true}'),
      ('fa-classic','Iranian Classic','فاکتور کلاسیک','invoice','{"variant": "کلاسیک", "accentColor": "#7c2d12", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "rtl": true}'),
      ('fa-modern','Iranian Modern','فاکتور مدرن','invoice','{"variant": "مدرن", "accentColor": "#0f766e", "showLogo": true, "showSignature": true, "showQr": true, "showBarcode": true, "rtl": true}'),
      ('fa-gold','Iranian Gold','فاکتور طلایی','invoice','{"variant": "ویژه", "accentColor": "#b45309", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "rtl": true}'),
      ('fa-contract','Iranian Contract','قرارداد رسمی','contract','{"variant": "قرارداد", "accentColor": "#155e75", "headerNote": "بسمه تعالی", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "terms": "این قرارداد در تاریخ درج‌شده میان طرفین منعقد و مفاد آن برای هر دو طرف لازم‌الاجراست. هرگونه تغییر تنها با توافق کتبی طرفین معتبر است.", "paymentInstructions": "واریز به شماره شبای زیر با درج شماره قرارداد در توضیحات.", "rtl": true}'),
      ('fa-letterhead','Iranian Letterhead','سربرگ رسمی شرکت','contract','{"variant": "سربرگ رسمی", "accentColor": "#0f766e", "headerNote": "بسمه تعالی", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": false, "footerNote": "این سند روی سربرگ رسمی شرکت صادر شده است.", "rtl": true}'),
      ('fa-vat','Iranian VAT','فاکتور ارزش افزوده','invoice','{"variant": "ارزش افزوده ۹٪", "accentColor": "#065f46", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "rtl": true}'),
      ('fa-export','Iranian Export','فاکتور صادراتی','invoice','{"variant": "صادراتی", "accentColor": "#0369a1", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "rtl": true}'),
      ('fa-compact','Iranian Compact','فاکتور فشرده','invoice','{"variant": "فشرده", "accentColor": "#525252", "showLogo": true, "showBarcode": true, "rtl": true}'),
      ('fa-elegant','Iranian Elegant','فاکتور شیک','invoice','{"variant": "ویژه", "accentColor": "#9d174d", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "rtl": true}'),
      ('fa-industrial','Iranian Industrial','فاکتور صنعتی','invoice','{"variant": "صنعتی", "accentColor": "#374151", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "showBarcode": true, "rtl": true}'),
      ('fa-clinic','Iranian Clinic','فاکتور مطب/کلینیک','invoice','{"variant": "خدمات درمانی", "accentColor": "#0e7490", "showLogo": true, "showSignature": true, "showQr": true, "rtl": true}')
    ON CONFLICT (key) DO NOTHING;

    -- Enterprise Project Management (Phase 21 ERP, Module 6). Projects with
    -- tasks (Kanban/Gantt), milestones and timesheets.
    CREATE TABLE IF NOT EXISTS pm_projects (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      customer TEXT,
      manager TEXT,
      status TEXT NOT NULL DEFAULT 'planning' CHECK(status IN ('planning','active','on_hold','completed','cancelled')),
      start_date TEXT,
      end_date TEXT,
      budget NUMERIC NOT NULL DEFAULT 0,
      hourly_rate NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS pm_tasks (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','review','done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      assignee TEXT,
      estimate_hours NUMERIC NOT NULL DEFAULT 0,
      start_date TEXT,
      due_date TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS pm_milestones (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reached','missed')),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS pm_timesheets (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES pm_tasks(id) ON DELETE SET NULL,
      person TEXT NOT NULL,
      date TEXT NOT NULL,
      hours NUMERIC NOT NULL DEFAULT 0,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Project Costing (Phase 21.4): cost + revenue entries per project. Labor
    -- cost is also derived from timesheets × the project rate in the engine.
    CREATE TABLE IF NOT EXISTS pm_cost_entries (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'cost' CHECK(kind IN ('cost','revenue')),
      category TEXT NOT NULL DEFAULT 'other',
      description TEXT,
      amount NUMERIC NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Enterprise Sales (Phase 21 ERP, Module 2). Customers with a credit limit;
    -- a unified sales document (quote/order/invoice/credit_note) with lines
    -- carrying discount % and tax %; and payments applied to invoices.
    -- Phase 26.2: real/legal party identity on customers.
    CREATE TABLE IF NOT EXISTS sales_customers (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      tax_id TEXT,
      credit_limit NUMERIC NOT NULL DEFAULT 0,
      address TEXT,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    ALTER TABLE sales_customers ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'company';
    ALTER TABLE sales_customers ADD COLUMN IF NOT EXISTS national_id TEXT;
    ALTER TABLE sales_customers ADD COLUMN IF NOT EXISTS reg_no TEXT;
    ALTER TABLE sales_customers ADD COLUMN IF NOT EXISTS economic_code TEXT;

    CREATE TABLE IF NOT EXISTS sales_documents (
      id SERIAL PRIMARY KEY,
      doc_type TEXT NOT NULL CHECK(doc_type IN ('quote','order','invoice','credit_note')),
      doc_no TEXT NOT NULL,
      customer_id INTEGER NOT NULL REFERENCES sales_customers(id),
      date TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','confirmed','partial','paid','void')),
      subtotal NUMERIC NOT NULL DEFAULT 0,
      discount_total NUMERIC NOT NULL DEFAULT 0,
      tax_total NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      source_id INTEGER REFERENCES sales_documents(id),
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS sales_document_lines (
      id SERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES sales_documents(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      qty NUMERIC NOT NULL DEFAULT 1,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      discount_pct NUMERIC NOT NULL DEFAULT 0,
      tax_pct NUMERIC NOT NULL DEFAULT 0,
      line_total NUMERIC NOT NULL DEFAULT 0,
      line_no INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sales_payments (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES sales_customers(id),
      document_id INTEGER REFERENCES sales_documents(id),
      date TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      method TEXT NOT NULL DEFAULT 'cash' CHECK(method IN ('cash','bank','card','cheque','other')),
      reference TEXT,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Enterprise Purchasing Platform (Phase 26.1) — procure-to-pay.
    CREATE TABLE IF NOT EXISTS purchase_vendors (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'company' CHECK(kind IN ('individual','company','international')),
      email TEXT, phone TEXT, tax_id TEXT, economic_code TEXT,
      address TEXT, iban TEXT, currency TEXT NOT NULL DEFAULT 'IRR',
      payment_terms INTEGER NOT NULL DEFAULT 0,
      score DOUBLE PRECISION NOT NULL DEFAULT 0,
      grade TEXT NOT NULL DEFAULT 'C',
      active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT, created_at TEXT NOT NULL DEFAULT (${NOW}), updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS purchase_documents (
      id SERIAL PRIMARY KEY,
      doc_no TEXT UNIQUE,
      doc_type TEXT NOT NULL CHECK(doc_type IN ('request','rfq','quotation','order','receipt','invoice','return','credit_note')),
      vendor_id INTEGER REFERENCES purchase_vendors(id),
      status TEXT NOT NULL DEFAULT 'draft',
      date TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IRR',
      department TEXT, project_id INTEGER,
      budget NUMERIC NOT NULL DEFAULT 0,
      source_id INTEGER,                  -- linked upstream doc (PR→PO→GRN→invoice)
      subtotal NUMERIC NOT NULL DEFAULT 0,
      discount_total NUMERIC NOT NULL DEFAULT 0,
      tax_total NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      paid_total NUMERIC NOT NULL DEFAULT 0,
      approval_levels INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_by TEXT, created_at TEXT NOT NULL DEFAULT (${NOW}), updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS purchase_document_lines (
      id SERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES purchase_documents(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      qty NUMERIC NOT NULL DEFAULT 1,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      discount_pct NUMERIC NOT NULL DEFAULT 0,
      tax_pct NUMERIC NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS purchase_approvals (
      id BIGSERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES purchase_documents(id) ON DELETE CASCADE,
      level INTEGER NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
      approver_id TEXT, comment TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS purchase_payments (
      id SERIAL PRIMARY KEY,
      vendor_id INTEGER NOT NULL REFERENCES purchase_vendors(id),
      document_id INTEGER REFERENCES purchase_documents(id),
      date TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      method TEXT NOT NULL DEFAULT 'bank' CHECK(method IN ('cash','bank','card','cheque','other')),
      reference TEXT, note TEXT,
      created_by TEXT, created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS vendor_evaluations (
      id BIGSERIAL PRIMARY KEY,
      vendor_id INTEGER NOT NULL REFERENCES purchase_vendors(id) ON DELETE CASCADE,
      quality NUMERIC NOT NULL DEFAULT 0, delivery NUMERIC NOT NULL DEFAULT 0,
      price NUMERIC NOT NULL DEFAULT 0, service NUMERIC NOT NULL DEFAULT 0, compliance NUMERIC NOT NULL DEFAULT 0,
      score DOUBLE PRECISION NOT NULL DEFAULT 0, grade TEXT NOT NULL DEFAULT 'C',
      note TEXT, evaluator_id TEXT, created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS vendor_contracts (
      id SERIAL PRIMARY KEY,
      vendor_id INTEGER NOT NULL REFERENCES purchase_vendors(id) ON DELETE CASCADE,
      title TEXT NOT NULL, ref_no TEXT,
      start_date TEXT, end_date TEXT,
      value NUMERIC NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'IRR',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','terminated')),
      note TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS gl_entry_id INTEGER;
    -- Phase 26.15.1: sales invoices now auto-post to the GL (Dr AR / Cr Revenue / Cr VAT).
    ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS gl_entry_id INTEGER;
    ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
    ALTER TABLE purchase_document_lines ADD COLUMN IF NOT EXISTS product_id INTEGER;
    ALTER TABLE purchase_document_lines ADD COLUMN IF NOT EXISTS received_qty NUMERIC NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_pur_lines_product ON purchase_document_lines(product_id);
    CREATE INDEX IF NOT EXISTS idx_pur_docs_type ON purchase_documents(doc_type, status);
    CREATE INDEX IF NOT EXISTS idx_pur_docs_vendor ON purchase_documents(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_pur_lines_doc ON purchase_document_lines(document_id);
    CREATE INDEX IF NOT EXISTS idx_pur_approvals_doc ON purchase_approvals(document_id);
    CREATE INDEX IF NOT EXISTS idx_pur_payments_vendor ON purchase_payments(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_evals_vendor ON vendor_evaluations(vendor_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_vendor_contracts_vendor ON vendor_contracts(vendor_id);

    -- Phase 26.1: Vendor Portal — token-gated, read-only external access.
    CREATE TABLE IF NOT EXISTS vendor_portal_tokens (
      id SERIAL PRIMARY KEY,
      vendor_id INTEGER NOT NULL REFERENCES purchase_vendors(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      revoked BOOLEAN NOT NULL DEFAULT false,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      last_used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_vendor_tokens_vendor ON vendor_portal_tokens(vendor_id);

    -- Phase 26: multi-company (branch accounting + consolidated statements).
    CREATE TABLE IF NOT EXISTS erp_companies (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    INSERT INTO erp_companies (code, name_en, name_fa, is_default)
      VALUES ('HQ', 'Head Office', 'دفتر مرکزی', true)
      ON CONFLICT (code) DO NOTHING;
    ALTER TABLE erp_companies ADD COLUMN IF NOT EXISTS reg_no TEXT;
    ALTER TABLE erp_companies ADD COLUMN IF NOT EXISTS national_id TEXT;
    ALTER TABLE erp_companies ADD COLUMN IF NOT EXISTS economic_code TEXT;
    ALTER TABLE erp_companies ADD COLUMN IF NOT EXISTS tax_no TEXT;
    ALTER TABLE erp_companies ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE erp_companies ADD COLUMN IF NOT EXISTS phone TEXT;

    -- Phase 26.4: monthly sales targets + commission config.
    -- Phase 26.9: sales price lists (named catalogs of product prices) + a
    -- product link on sales lines so a list can fill description + unit price.
    CREATE TABLE IF NOT EXISTS price_lists (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IRR',
      is_default BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS price_list_items (
      id BIGSERIAL PRIMARY KEY,
      price_list_id INTEGER NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      UNIQUE(price_list_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_price_list_items_list ON price_list_items(price_list_id);
    ALTER TABLE sales_document_lines ADD COLUMN IF NOT EXISTS product_id INTEGER;

    CREATE TABLE IF NOT EXISTS sales_targets (
      id SERIAL PRIMARY KEY,
      period TEXT UNIQUE NOT NULL,            -- YYYY-MM
      target NUMERIC NOT NULL DEFAULT 0,
      commission_pct NUMERIC NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Enterprise Financial System (Phase 21 ERP, Module 1) — double-entry GL.
    CREATE TABLE IF NOT EXISTS gl_fiscal_periods (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    -- Phase 26.9: fiscal-period lifecycle — kind (year|period), hierarchy, and
    -- open→closed→locked with a widened status check + close/lock audit stamps.
    ALTER TABLE gl_fiscal_periods ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'period';
    ALTER TABLE gl_fiscal_periods ADD COLUMN IF NOT EXISTS parent_id INTEGER;
    ALTER TABLE gl_fiscal_periods ADD COLUMN IF NOT EXISTS closed_at TEXT;
    ALTER TABLE gl_fiscal_periods ADD COLUMN IF NOT EXISTS closed_by TEXT;
    ALTER TABLE gl_fiscal_periods ADD COLUMN IF NOT EXISTS locked_at TEXT;
    DO $do$ BEGIN
      ALTER TABLE gl_fiscal_periods DROP CONSTRAINT IF EXISTS gl_fiscal_periods_status_check;
      ALTER TABLE gl_fiscal_periods ADD CONSTRAINT gl_fiscal_periods_status_check3 CHECK(status IN ('open','closed','locked'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

    -- Phase 26.7: multi-currency transactions — every financial document keeps
    -- its transaction currency + the Rial exchange rate + the Rial base amount.
    ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'IRR';
    -- Phase 26.7: soft delete with an audit trail (deleted docs also become
    -- 'void' so every existing aggregate keeps excluding them unchanged).
    ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS deleted_at TEXT;
    ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS deleted_by TEXT;
    ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS delete_reason TEXT;
    -- Phase 26.9: allow debit notes alongside credit notes.
    DO $do$ BEGIN
      ALTER TABLE sales_documents DROP CONSTRAINT IF EXISTS sales_documents_doc_type_check;
      ALTER TABLE sales_documents ADD CONSTRAINT sales_documents_doc_type_check2 CHECK(doc_type IN ('quote','order','invoice','credit_note','debit_note'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC NOT NULL DEFAULT 1;
    ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS base_total NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC NOT NULL DEFAULT 1;
    ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS base_total NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE sales_payments ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'IRR';
    ALTER TABLE sales_payments ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC NOT NULL DEFAULT 1;
    ALTER TABLE purchase_payments ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'IRR';
    ALTER TABLE purchase_payments ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC NOT NULL DEFAULT 1;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'IRR';
    -- 26.8: the Rial rate captured at registration (original info immutable).
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC NOT NULL DEFAULT 1;

    -- Phase 26.7: global ERP configuration (currency defaults, formatting).
    -- 26.23: reusable journal-entry templates (save/load/copy in the editor).
    CREATE TABLE IF NOT EXISTS gl_entry_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      memo TEXT,
      lines TEXT NOT NULL DEFAULT '[]',
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS erp_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    INSERT INTO erp_settings (key, value) VALUES
      ('default_currency', 'IRR'),
      ('display_currency', 'IRR'),
      ('decimal_precision', '0'),
      -- 26.23: configurable GL posting map (defaults = the seeded chart).
      ('gl_map_ar', '1100'),
      ('gl_map_revenue', '4000'),
      ('gl_map_vat', '2100'),
      ('gl_map_ap', '2000'),
      ('gl_map_inventory', '1200'),
      ('gl_map_bank', '1010'),
      -- 26.23: maker/checker for journal posting (off = backward compatible).
      ('gl_posting_approval', 'off'),
      ('gl_posting_approval_threshold', '500000000'),
      -- 26.23: CRM follow-up SLA (days without activity on an open lead).
      ('crm_sla_days', '7'),
      -- 26.24: Iran compliance — مودیان + payment gateway (empty = sandbox).
      ('moadian_api_url', ''),
      ('moadian_memory_id', ''),
      ('moadian_private_key', ''),
      ('company_economic_code', ''),
      ('pay_sandbox', 'true'),
      ('pay_zarinpal_merchant', ''),
      ('number_format', 'standard')
    ON CONFLICT (key) DO NOTHING;

    -- Phase 26: multi-currency (base = Iranian Rial; Toman is a display unit).
    CREATE TABLE IF NOT EXISTS erp_currencies (
      code TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      symbol_en TEXT NOT NULL,
      symbol_fa TEXT NOT NULL,
      decimals INTEGER NOT NULL DEFAULT 2,
      is_base BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS erp_exchange_rates (
      id BIGSERIAL PRIMARY KEY,
      code TEXT NOT NULL REFERENCES erp_currencies(code),
      rate_date TEXT NOT NULL,          -- YYYY-MM-DD
      base_rate DOUBLE PRECISION NOT NULL,   -- Rial value of one unit
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE(code, rate_date)
    );
    CREATE INDEX IF NOT EXISTS idx_erp_rates_code ON erp_exchange_rates(code, rate_date DESC);

    -- Phase 26: Banking — accounts, statement reconciliation, cheques, petty cash.
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      bank TEXT,
      iban TEXT,
      account_no TEXT,
      currency TEXT NOT NULL DEFAULT 'IRR',
      opening_balance NUMERIC NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS bank_statement_lines (
      id BIGSERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      description TEXT,
      amount NUMERIC NOT NULL,               -- signed: + inflow, - outflow
      reference TEXT,
      status TEXT NOT NULL DEFAULT 'unmatched' CHECK(status IN ('unmatched','matched','excluded')),
      matched_ref TEXT,                      -- e.g. sales_payment:12 | purchase_payment:7
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS cheques (
      id SERIAL PRIMARY KEY,
      direction TEXT NOT NULL CHECK(direction IN ('issued','received')),
      number TEXT NOT NULL,
      party TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'IRR',
      due_date TEXT,
      bank_account_id INTEGER REFERENCES bank_accounts(id),
      status TEXT NOT NULL DEFAULT 'draft',
      note TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS petty_cash_entries (
      id BIGSERIAL PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('float','expense','replenish')),
      date TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      category TEXT,
      note TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_stmt_lines_account ON bank_statement_lines(account_id, status);
    CREATE INDEX IF NOT EXISTS idx_cheques_status ON cheques(status, due_date);
    CREATE INDEX IF NOT EXISTS idx_petty_date ON petty_cash_entries(date DESC);
    -- Phase 26.9: tax profiles — reusable named tax setups over the pure tax
    -- engine (VAT + withholding + exemption + category). Iran-ready seeds.
    CREATE TABLE IF NOT EXISTS tax_profiles (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'standard' CHECK(category IN ('standard','zero_rated','exempt','export','service')),
      vat_rate NUMERIC NOT NULL DEFAULT 0,
      withholding_rate NUMERIC NOT NULL DEFAULT 0,
      exempt BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    INSERT INTO tax_profiles (code, name_en, name_fa, category, vat_rate, withholding_rate, exempt) VALUES
      ('STD9','Standard VAT 9%','ارزش افزوده استاندارد ۹٪','standard',9,0,false),
      ('EXEMPT','Tax exempt','معاف از مالیات','exempt',0,0,true),
      ('ZERO','Zero-rated','نرخ صفر','zero_rated',0,0,false),
      ('EXPORT','Export (0%)','صادرات','export',0,0,false),
      ('SVC9W5','Service VAT 9% + WHT 5%','خدمات ۹٪ + تکلیفی ۵٪','service',9,5,false)
    ON CONFLICT (code) DO NOTHING;

    -- Seed the built-in currencies idempotently.
    INSERT INTO erp_currencies (code, name_en, name_fa, symbol_en, symbol_fa, decimals, is_base) VALUES
      ('IRR','Iranian Rial','ریال','IRR','ریال',0,true),
      ('IRT','Iranian Toman','تومان','Toman','تومان',0,false),
      ('USD','US Dollar','دلار آمریکا','$','دلار',2,false),
      ('EUR','Euro','یورو','€','یورو',2,false),
      ('AED','UAE Dirham','درهم امارات','AED','درهم',2,false)
    ON CONFLICT (code) DO NOTHING;

    CREATE TABLE IF NOT EXISTS gl_accounts (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      type TEXT NOT NULL CHECK(type IN ('asset','liability','equity','revenue','expense')),
      parent_id INTEGER REFERENCES gl_accounts(id),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS gl_journal_entries (
      id SERIAL PRIMARY KEY,
      entry_no TEXT NOT NULL,
      date TEXT NOT NULL,
      memo TEXT,
      reference TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','void')),
      period_id INTEGER REFERENCES gl_fiscal_periods(id),
      total NUMERIC NOT NULL DEFAULT 0,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      posted_at TEXT
    );
    ALTER TABLE gl_journal_entries ADD COLUMN IF NOT EXISTS company_id INTEGER;
    ALTER TABLE gl_journal_entries ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'IRR';
    ALTER TABLE gl_journal_entries ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC NOT NULL DEFAULT 1;
    CREATE INDEX IF NOT EXISTS idx_gl_entries_company ON gl_journal_entries(company_id);

    CREATE TABLE IF NOT EXISTS gl_journal_lines (
      id SERIAL PRIMARY KEY,
      entry_id INTEGER NOT NULL REFERENCES gl_journal_entries(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES gl_accounts(id),
      debit NUMERIC NOT NULL DEFAULT 0,
      credit NUMERIC NOT NULL DEFAULT 0,
      memo TEXT,
      line_no INTEGER NOT NULL DEFAULT 0
    );

    -- Seed a standard chart of accounts once (idempotent).
    INSERT INTO gl_accounts (code, name_en, name_fa, type) VALUES
      ('1000','Cash','نقد','asset'),
      ('1010','Bank','بانک','asset'),
      ('1100','Accounts Receivable','حساب‌های دریافتنی','asset'),
      ('1200','Inventory','موجودی کالا','asset'),
      ('1500','Fixed Assets','دارایی‌های ثابت','asset'),
      ('2000','Accounts Payable','حساب‌های پرداختنی','liability'),
      ('2100','Taxes Payable','مالیات پرداختنی','liability'),
      ('2500','Loans Payable','تسهیلات پرداختنی','liability'),
      ('3000','Owner Equity','سرمایه','equity'),
      ('3900','Retained Earnings','سود انباشته','equity'),
      ('4000','Sales Revenue','درآمد فروش','revenue'),
      ('4100','Service Revenue','درآمد خدمات','revenue'),
      ('5000','Cost of Goods Sold','بهای تمام‌شدهٔ کالا','expense'),
      ('6000','Salaries Expense','هزینهٔ حقوق','expense'),
      ('6100','Rent Expense','هزینهٔ اجاره','expense'),
      ('6200','Utilities Expense','هزینهٔ آب و برق','expense'),
      ('6900','Depreciation Expense','هزینهٔ استهلاک','expense')
    ON CONFLICT (code) DO NOTHING;

    -- Phase 26.5: intercompany clearing accounts (idempotent seed).
    INSERT INTO gl_accounts (code, name_en, name_fa, type, active)
      SELECT '1150', 'Due From Affiliates', 'دریافتنی از شرکت‌های گروه', 'asset', 1
      WHERE NOT EXISTS (SELECT 1 FROM gl_accounts WHERE code='1150');

    -- 26.22: Iranian-standard coding — گروه (group) level accounts seeded as
    -- hierarchy roots; every leaf account is attached by its leading digit
    -- (گروه → کل/معین via parent_id, idempotent: only NULL parents are set).
    INSERT INTO gl_accounts (code, name_en, name_fa, type, active)
      SELECT v.code, v.en, v.fa, v.t, 1 FROM (VALUES
        ('1','Assets','دارایی‌ها','asset'),
        ('2','Liabilities','بدهی‌ها','liability'),
        ('3','Equity','حقوق صاحبان سهام','equity'),
        ('4','Revenue','درآمدها','revenue'),
        ('5','Cost of Goods','بهای تمام‌شده','expense'),
        ('6','Operating Expenses','هزینه‌های عملیاتی','expense')
      ) AS v(code, en, fa, t)
      WHERE NOT EXISTS (SELECT 1 FROM gl_accounts g WHERE g.code = v.code);

    INSERT INTO gl_accounts (code, name_en, name_fa, type, active)
      SELECT '2150', 'Due To Affiliates', 'پرداختنی به شرکت‌های گروه', 'liability', 1
      WHERE NOT EXISTS (SELECT 1 FROM gl_accounts WHERE code='2150');

    -- Phase 26.8: currency revaluation accounts (idempotent seed).
    INSERT INTO gl_accounts (code, name_en, name_fa, type, active)
      SELECT '1190', 'FX Revaluation Adjustment', 'تعدیل تسعیر ارز', 'asset', 1
      WHERE NOT EXISTS (SELECT 1 FROM gl_accounts WHERE code='1190');
    INSERT INTO gl_accounts (code, name_en, name_fa, type, active)
      SELECT '4900', 'Currency Gain', 'سود تسعیر ارز', 'revenue', 1
      WHERE NOT EXISTS (SELECT 1 FROM gl_accounts WHERE code='4900');
    INSERT INTO gl_accounts (code, name_en, name_fa, type, active)
      SELECT '6980', 'Currency Loss', 'زیان تسعیر ارز', 'expense', 1
      WHERE NOT EXISTS (SELECT 1 FROM gl_accounts WHERE code='6980');

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
    -- Phase 26.16: product master gains a default supplier (soft ref → purchase_vendors).
    ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS default_supplier_id INTEGER;

    -- Phase 26.17 M1 — enterprise product category tree (unlimited hierarchy).
    CREATE TABLE IF NOT EXISTS erp_categories (
      id SERIAL PRIMARY KEY,
      parent_id INTEGER REFERENCES erp_categories(id),
      code TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      description TEXT,
      level INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_categories_code ON erp_categories(code);
    CREATE INDEX IF NOT EXISTS idx_erp_categories_parent ON erp_categories(parent_id);
    -- Products link to the tree (soft ref; keeps the legacy free-text category column).
    ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS category_id INTEGER;

    -- Phase 26.17 M2 — product ↔ supplier relationships (alternative suppliers).
    CREATE TABLE IF NOT EXISTS inv_product_suppliers (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES inv_products(id) ON DELETE CASCADE,
      supplier_id INTEGER NOT NULL REFERENCES purchase_vendors(id),
      supplier_code TEXT,
      purchase_price NUMERIC NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'IRR',
      lead_time_days INTEGER NOT NULL DEFAULT 0,
      minimum_order_qty NUMERIC NOT NULL DEFAULT 0,
      quality_score NUMERIC NOT NULL DEFAULT 0,
      delivery_score NUMERIC NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prod_supplier ON inv_product_suppliers(product_id, supplier_id);

    -- Phase 26.17 M3 — master-data version history (old/new JSON + restore).
    CREATE TABLE IF NOT EXISTS master_data_history (
      id SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT,
      change_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_md_history_entity ON master_data_history(entity_type, entity_id);

    -- Phase 26.17 M5 — data-steward issue queue (assign / resolve / ignore).
    CREATE TABLE IF NOT EXISTS master_data_issues (
      id SERIAL PRIMARY KEY,
      issue_key TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_fa TEXT,
      severity TEXT NOT NULL DEFAULT 'warning',
      status TEXT NOT NULL DEFAULT 'open',
      assigned_to TEXT,
      resolution_note TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_md_issues_status ON master_data_issues(status);

    -- Phase 26.18 — Enterprise Data Import & Migration Center.
    CREATE TABLE IF NOT EXISTS import_templates (
      id SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      fields TEXT NOT NULL DEFAULT '[]',
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS import_mappings (
      id SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      source_system TEXT,
      mapping TEXT NOT NULL DEFAULT '{}',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS import_jobs (
      id SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      source_system TEXT,
      file_name TEXT,
      file_hash TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','mapping','validating','validated','approved','processing','completed','failed','rolled_back')),
      total_rows INTEGER NOT NULL DEFAULT 0,
      valid_rows INTEGER NOT NULL DEFAULT 0,
      warning_rows INTEGER NOT NULL DEFAULT 0,
      error_rows INTEGER NOT NULL DEFAULT 0,
      imported_rows INTEGER NOT NULL DEFAULT 0,
      mapping TEXT NOT NULL DEFAULT '{}',
      approval_tier TEXT NOT NULL DEFAULT 'auto',
      approved_by TEXT,
      approved_at TEXT,
      error TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW}),
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
    CREATE TABLE IF NOT EXISTS import_job_rows (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
      row_no INTEGER NOT NULL,
      raw TEXT NOT NULL DEFAULT '{}',
      mapped TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','valid','warning','error','imported','skipped')),
      message TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_import_job_rows_job ON import_job_rows(job_id, status);
    CREATE TABLE IF NOT EXISTS import_validation_errors (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
      row_no INTEGER NOT NULL,
      field TEXT,
      code TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'error',
      message TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_import_val_errors_job ON import_validation_errors(job_id);
    CREATE TABLE IF NOT EXISTS import_history (
      id SERIAL PRIMARY KEY,
      job_id INTEGER REFERENCES import_jobs(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      actor TEXT,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS migration_transactions (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      op TEXT NOT NULL DEFAULT 'insert',
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_migration_tx_job ON migration_transactions(job_id);

    -- Phase 26.19 — Enterprise Inventory & Supply Chain platform.
    ALTER TABLE inv_warehouses ADD COLUMN IF NOT EXISTS wtype TEXT NOT NULL DEFAULT 'standard';
    ALTER TABLE inv_warehouses ADD COLUMN IF NOT EXISTS capacity NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE inv_warehouses ADD COLUMN IF NOT EXISTS temperature_controlled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE inv_locations ADD COLUMN IF NOT EXISTS zone TEXT;
    ALTER TABLE inv_locations ADD COLUMN IF NOT EXISTS aisle TEXT;

    CREATE TABLE IF NOT EXISTS inv_batches (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES inv_products(id) ON DELETE CASCADE,
      warehouse_id INTEGER NOT NULL REFERENCES inv_warehouses(id),
      batch_no TEXT NOT NULL,
      production_date TEXT,
      expiry_date TEXT,
      manufacturer TEXT,
      qty_received NUMERIC NOT NULL DEFAULT 0,
      qty_remaining NUMERIC NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE (product_id, warehouse_id, batch_no)
    );
    CREATE INDEX IF NOT EXISTS idx_inv_batches_expiry ON inv_batches(expiry_date);

    CREATE TABLE IF NOT EXISTS inv_serials (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES inv_products(id) ON DELETE CASCADE,
      warehouse_id INTEGER NOT NULL REFERENCES inv_warehouses(id),
      batch_id INTEGER REFERENCES inv_batches(id),
      serial TEXT NOT NULL UNIQUE,
      imei TEXT,
      status TEXT NOT NULL DEFAULT 'in_stock' CHECK(status IN ('in_stock','reserved','sold','returned','damaged','recalled')),
      warranty_start TEXT,
      warranty_months INTEGER,
      ref TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_inv_serials_imei ON inv_serials(imei);
    CREATE INDEX IF NOT EXISTS idx_inv_serials_product ON inv_serials(product_id, status);

    CREATE TABLE IF NOT EXISTS inv_reservations (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES inv_products(id) ON DELETE CASCADE,
      warehouse_id INTEGER NOT NULL REFERENCES inv_warehouses(id),
      kind TEXT NOT NULL DEFAULT 'reserve' CHECK(kind IN ('reserve','block','damage')),
      qty NUMERIC NOT NULL,
      ref TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','released','consumed')),
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      released_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_inv_reservations_pw ON inv_reservations(product_id, warehouse_id, status);

    CREATE TABLE IF NOT EXISTS inv_counts (
      id SERIAL PRIMARY KEY,
      warehouse_id INTEGER NOT NULL REFERENCES inv_warehouses(id),
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','counting','submitted','approved','posted','cancelled')),
      note TEXT,
      created_by TEXT,
      approved_by TEXT,
      gl_entry_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS inv_count_lines (
      id SERIAL PRIMARY KEY,
      count_id INTEGER NOT NULL REFERENCES inv_counts(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES inv_products(id),
      system_qty NUMERIC NOT NULL DEFAULT 0,
      counted_qty NUMERIC,
      unit_cost NUMERIC NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_inv_count_lines ON inv_count_lines(count_id);

    CREATE TABLE IF NOT EXISTS inv_shipments (
      id SERIAL PRIMARY KEY,
      shipment_no TEXT NOT NULL,
      warehouse_id INTEGER NOT NULL REFERENCES inv_warehouses(id),
      customer_id INTEGER,
      carrier TEXT,
      tracking_no TEXT,
      container_no TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','picking','packed','shipped','delivered','returned','cancelled')),
      ref TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW}),
      shipped_at TEXT,
      delivered_at TEXT
    );
    CREATE TABLE IF NOT EXISTS inv_shipment_lines (
      id SERIAL PRIMARY KEY,
      shipment_id INTEGER NOT NULL REFERENCES inv_shipments(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES inv_products(id),
      qty NUMERIC NOT NULL,
      serial TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_inv_shipment_lines ON inv_shipment_lines(shipment_id);

    -- Phase 26.20 — Self-Healing Engine + Operational Health Center.
    CREATE TABLE IF NOT EXISTS selfheal_runs (
      id SERIAL PRIMARY KEY,
      started_by TEXT REFERENCES users(id),
      issues INTEGER NOT NULL DEFAULT 0,
      fixed INTEGER NOT NULL DEFAULT 0,
      risk NUMERIC NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      finished_at TEXT
    );
    CREATE TABLE IF NOT EXISTS selfheal_findings (
      id SERIAL PRIMARY KEY,
      run_id INTEGER NOT NULL REFERENCES selfheal_runs(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('critical','warning','info')),
      action TEXT NOT NULL DEFAULT 'alert' CHECK(action IN ('auto_fixed','alert','recommendation')),
      count INTEGER NOT NULL DEFAULT 0,
      fixed INTEGER NOT NULL DEFAULT 0,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_selfheal_findings_run ON selfheal_findings(run_id);

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
    ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS embedding TEXT;
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
    -- ═══════════════════════════════════════════════════════════════════════
    -- Phase 26.11 — Enterprise Financial Intelligence Platform
    -- ═══════════════════════════════════════════════════════════════════════
    -- Cost / Profit centers (M3/M4): the canonical registry (replaces the
    -- free-text assets.cost_center/department). A profit center is a cost center
    -- with kind='profit' (tracks revenue too) — no duplicate table.
    CREATE TABLE IF NOT EXISTS erp_cost_centers (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      kind TEXT NOT NULL DEFAULT 'department' CHECK(kind IN ('department','branch','project','business_unit','profit')),
      parent_id INTEGER REFERENCES erp_cost_centers(id),
      manager_user_id TEXT REFERENCES users(id),
      company_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_cost_centers_kind ON erp_cost_centers(kind, active);
    -- Every financial transaction can carry a cost_center_id (additive).
    ALTER TABLE gl_journal_lines ADD COLUMN IF NOT EXISTS cost_center_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_gl_lines_cc ON gl_journal_lines(cost_center_id);
    ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS cost_center_id INTEGER;
    ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS cost_center_id INTEGER;
    -- Department-manager cost-center scope (RBAC restriction, M12).
    CREATE TABLE IF NOT EXISTS erp_cost_center_members (
      id SERIAL PRIMARY KEY,
      cost_center_id INTEGER NOT NULL REFERENCES erp_cost_centers(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'viewer',
      UNIQUE (cost_center_id, user_id)
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS finance_role TEXT;
    -- 26.22: unique personnel code (auto-assigned EMP-#### on user creation).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_code ON users(employee_code) WHERE employee_code IS NOT NULL;

    -- Budgets (M1): header + lines + immutable version snapshots.
    CREATE TABLE IF NOT EXISTS erp_budgets (
      id SERIAL PRIMARY KEY,
      code TEXT,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      budget_type TEXT NOT NULL DEFAULT 'annual' CHECK(budget_type IN ('annual','monthly','department','project','branch','company','cost_center')),
      fiscal_year INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IRR',
      company_id INTEGER,
      cost_center_id INTEGER REFERENCES erp_cost_centers(id),
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','approved','locked')),
      version INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      approved_by TEXT REFERENCES users(id),
      approved_at TEXT,
      locked_at TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_budgets_fy ON erp_budgets(fiscal_year, status);
    CREATE TABLE IF NOT EXISTS erp_budget_lines (
      id SERIAL PRIMARY KEY,
      budget_id INTEGER NOT NULL REFERENCES erp_budgets(id) ON DELETE CASCADE,
      cost_center_id INTEGER REFERENCES erp_cost_centers(id),
      account_id INTEGER REFERENCES gl_accounts(id),
      category TEXT NOT NULL,
      period TEXT,
      amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      line_no INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON erp_budget_lines(budget_id);
    CREATE TABLE IF NOT EXISTS erp_budget_versions (
      id SERIAL PRIMARY KEY,
      budget_id INTEGER NOT NULL REFERENCES erp_budgets(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      status TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE (budget_id, version)
    );

    -- Forecasts (M5): saved forecast snapshots.
    CREATE TABLE IF NOT EXISTS erp_forecasts (
      id SERIAL PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      metric TEXT NOT NULL CHECK(metric IN ('revenue','expense','cash_flow','profit')),
      method TEXT NOT NULL CHECK(method IN ('trend','moving_average','growth','seasonal')),
      horizon INTEGER NOT NULL DEFAULT 3,
      currency TEXT NOT NULL DEFAULT 'IRR',
      result TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- KPI snapshots (M6): periodic snapshot of the KPI set for trend history.
    CREATE TABLE IF NOT EXISTS erp_kpi_snapshots (
      id SERIAL PRIMARY KEY,
      as_of TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IRR',
      kpis TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_asof ON erp_kpi_snapshots(as_of);

    -- Financial alerts (M9): deduped by fingerprint.
    CREATE TABLE IF NOT EXISTS erp_financial_alerts (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning' CHECK(severity IN ('info','warning','critical')),
      title_en TEXT NOT NULL,
      title_fa TEXT,
      detail TEXT,
      metric_value NUMERIC,
      ref_type TEXT,
      ref_id INTEGER,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved')),
      fingerprint TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_fin_alerts_status ON erp_financial_alerts(status, severity);

    -- Seed default cost centers once (idempotent).
    INSERT INTO erp_cost_centers (code, name_en, name_fa, kind) VALUES
      ('CC-IT','IT Operations','عملیات فناوری اطلاعات','department'),
      ('CC-HQ','Headquarters','دفتر مرکزی','branch'),
      ('PC-SALES','Sales','فروش','profit')
    ON CONFLICT (code) DO NOTHING;

    CREATE INDEX IF NOT EXISTS idx_gl_lines_entry ON gl_journal_lines(entry_id);
    CREATE INDEX IF NOT EXISTS idx_gl_lines_account ON gl_journal_lines(account_id);
    CREATE INDEX IF NOT EXISTS idx_gl_entries_status ON gl_journal_entries(status, date);
    CREATE INDEX IF NOT EXISTS idx_gl_accounts_type ON gl_accounts(type);
    CREATE INDEX IF NOT EXISTS idx_sales_docs_type ON sales_documents(doc_type, status);
    CREATE INDEX IF NOT EXISTS idx_sales_docs_customer ON sales_documents(customer_id);
    CREATE INDEX IF NOT EXISTS idx_sales_lines_doc ON sales_document_lines(document_id);
    CREATE INDEX IF NOT EXISTS idx_sales_payments_customer ON sales_payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_sales_payments_doc ON sales_payments(document_id);
    CREATE INDEX IF NOT EXISTS idx_pm_tasks_project ON pm_tasks(project_id, status);
    CREATE INDEX IF NOT EXISTS idx_pm_milestones_project ON pm_milestones(project_id);
    CREATE INDEX IF NOT EXISTS idx_pm_timesheets_project ON pm_timesheets(project_id);
    CREATE INDEX IF NOT EXISTS idx_pm_projects_status ON pm_projects(status);
    CREATE INDEX IF NOT EXISTS idx_pm_costs_project ON pm_cost_entries(project_id, kind);
    CREATE INDEX IF NOT EXISTS idx_gen_docs_type ON gen_documents(type, created_at);
    CREATE INDEX IF NOT EXISTS idx_gen_docs_verify ON gen_documents(verify_code);
    CREATE INDEX IF NOT EXISTS idx_rule_versions_rid ON business_rule_versions(rule_id, version);
    CREATE INDEX IF NOT EXISTS idx_rules_category ON business_rules(category);
    CREATE INDEX IF NOT EXISTS idx_int_dispatches_conn ON integration_dispatches(connector_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_int_dispatches_status ON integration_dispatches(status);
    CREATE INDEX IF NOT EXISTS idx_syslogs_level_ts ON system_logs(level, ts);
    CREATE INDEX IF NOT EXISTS idx_syslogs_source ON system_logs(source);
    CREATE INDEX IF NOT EXISTS idx_syslogs_fingerprint ON system_logs(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_backups_started ON backups(started_at);
    CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
    CREATE INDEX IF NOT EXISTS idx_assets_type_status ON assets(type, status);
    CREATE INDEX IF NOT EXISTS idx_assets_warranty ON assets(warranty_expiry);
    CREATE INDEX IF NOT EXISTS idx_wf_runs_wf ON workflow_runs(workflow_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_wf_status ON workflows(status);

    -- ═══════════════════════════════════════════════════════════════════════
    -- Phase 26.12 — Enterprise Approval & Workflow Intelligence
    -- ═══════════════════════════════════════════════════════════════════════
    -- Central approval matrix (M1): docType × amount range × optional condition
    -- → ordered levels (JSON: [{level,mode,minCount,approvers[]}]).
    CREATE TABLE IF NOT EXISTS approval_matrix (
      id SERIAL PRIMARY KEY,
      doc_type TEXT NOT NULL,
      name_en TEXT,
      name_fa TEXT,
      min_amount NUMERIC NOT NULL DEFAULT 0,
      max_amount NUMERIC,
      condition TEXT,          -- JSON RouteCondition (rules engine)
      levels TEXT NOT NULL,    -- JSON ApprovalLevelPlan[]
      priority INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_appr_matrix_doc ON approval_matrix(doc_type, active);

    -- Approval requests (M8/M15): one per document routed for approval.
    CREATE TABLE IF NOT EXISTS approval_requests (
      id SERIAL PRIMARY KEY,
      doc_type TEXT NOT NULL,
      ref_type TEXT,           -- ERP table the document lives in
      ref_id INTEGER,
      title TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'IRR',
      department TEXT,
      cost_center_id INTEGER,
      project_id INTEGER,
      context TEXT,            -- JSON facts for routing/AI
      plan TEXT NOT NULL,      -- resolved ApprovalLevelPlan[] (snapshot)
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','changes_requested','cancelled')),
      current_level INTEGER NOT NULL DEFAULT 1,
      pending_since TEXT NOT NULL DEFAULT (${NOW}),
      decided_at TEXT,
      sla_breached INTEGER NOT NULL DEFAULT 0,
      escalation_stages TEXT NOT NULL DEFAULT '[]',
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_appr_req_status ON approval_requests(status, doc_type);
    CREATE INDEX IF NOT EXISTS idx_appr_req_ref ON approval_requests(ref_type, ref_id);

    -- Approval actions (M8/M13): every approve/reject/change with full audit.
    CREATE TABLE IF NOT EXISTS approval_actions (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
      level INTEGER NOT NULL,
      approver_id TEXT NOT NULL REFERENCES users(id),
      on_behalf_of TEXT REFERENCES users(id),   -- delegation
      decision TEXT NOT NULL CHECK(decision IN ('approved','rejected','changes_requested')),
      comment TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_appr_actions_req ON approval_actions(request_id);

    -- Delegations (M5).
    CREATE TABLE IF NOT EXISTS approval_delegations (
      id SERIAL PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      doc_type TEXT,
      department TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_appr_deleg_to ON approval_delegations(to_user_id, active);

    -- Escalation history (M6).
    CREATE TABLE IF NOT EXISTS workflow_escalations (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
      stage INTEGER NOT NULL,
      action TEXT NOT NULL,       -- reminder | escalate
      target TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE (request_id, stage)
    );

    -- Comments / collaboration (M9).
    CREATE TABLE IF NOT EXISTS workflow_comments (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      mentions TEXT,              -- JSON user ids
      attachment_url TEXT,
      internal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_wf_comments_req ON workflow_comments(request_id);

    -- Notification log (M12).
    CREATE TABLE IF NOT EXISTS workflow_notifications (
      id SERIAL PRIMARY KEY,
      request_id INTEGER REFERENCES approval_requests(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,      -- email | internal | webhook
      recipient TEXT,
      kind TEXT NOT NULL,         -- request | reminder | escalation | completion
      status TEXT NOT NULL DEFAULT 'queued',
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_wf_notif_req ON workflow_notifications(request_id);

    -- Seed the default enterprise purchase approval matrix once.
    INSERT INTO approval_matrix (doc_type, name_en, name_fa, min_amount, max_amount, levels) VALUES
      ('purchase_order','Purchase ≤ 100M','خرید تا ۱۰۰ میلیون',0,100000000,'[{"level":1,"mode":"all","approvers":[{"type":"role","ref":"dept_manager"}]}]'),
      ('purchase_order','Purchase 100M–1B','خرید ۱۰۰م تا ۱میلیارد',100000001,1000000000,'[{"level":1,"mode":"all","approvers":[{"type":"role","ref":"dept_manager"}]},{"level":2,"mode":"all","approvers":[{"type":"role","ref":"finance_manager"}]}]'),
      ('purchase_order','Purchase > 1B','خرید بالای ۱میلیارد',1000000001,NULL,'[{"level":1,"mode":"all","approvers":[{"type":"role","ref":"dept_manager"}]},{"level":2,"mode":"all","approvers":[{"type":"role","ref":"cfo"}]},{"level":3,"mode":"all","approvers":[{"type":"role","ref":"ceo"}]}]')
    ON CONFLICT DO NOTHING;

    -- ═══════════════════════════════════════════════════════════════════════
    -- Phase 26.13 — Business Operations Intelligence Platform
    -- ═══════════════════════════════════════════════════════════════════════
    -- KPI definitions + values (M2): formula-driven KPIs with target + history.
    CREATE TABLE IF NOT EXISTS kpi_definitions (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      category TEXT NOT NULL DEFAULT 'financial' CHECK(category IN ('company','department','employee','project','financial','sales','inventory')),
      formula TEXT,               -- expression over named metrics (kpiFormula engine)
      unit TEXT,                  -- %, IRR, days, ratio …
      direction TEXT NOT NULL DEFAULT 'higher_better' CHECK(direction IN ('higher_better','lower_better')),
      target NUMERIC,
      weight NUMERIC NOT NULL DEFAULT 1,
      owner_id TEXT REFERENCES users(id),
      cost_center_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_kpi_defs_cat ON kpi_definitions(category, active);
    CREATE TABLE IF NOT EXISTS kpi_values (
      id SERIAL PRIMARY KEY,
      kpi_id INTEGER NOT NULL REFERENCES kpi_definitions(id) ON DELETE CASCADE,
      period TEXT NOT NULL,       -- 'YYYY-MM' or 'YYYY'
      actual NUMERIC NOT NULL DEFAULT 0,
      target NUMERIC,
      attainment_pct NUMERIC,
      status TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE (kpi_id, period)
    );
    CREATE INDEX IF NOT EXISTS idx_kpi_values_kpi ON kpi_values(kpi_id, period);

    -- OKR (M3): objectives + key results, aligned company/department/employee.
    CREATE TABLE IF NOT EXISTS okr_objectives (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      level TEXT NOT NULL DEFAULT 'company' CHECK(level IN ('company','department','employee')),
      parent_id INTEGER REFERENCES okr_objectives(id),
      owner_id TEXT REFERENCES users(id),
      department TEXT,
      period TEXT NOT NULL,       -- e.g. '1405-Q1'
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','completed','cancelled')),
      confidence NUMERIC,
      progress_pct NUMERIC NOT NULL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_okr_obj_period ON okr_objectives(period, level);
    CREATE TABLE IF NOT EXISTS okr_results (
      id SERIAL PRIMARY KEY,
      objective_id INTEGER NOT NULL REFERENCES okr_objectives(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      start_value NUMERIC NOT NULL DEFAULT 0,
      target_value NUMERIC NOT NULL DEFAULT 100,
      current_value NUMERIC NOT NULL DEFAULT 0,
      weight NUMERIC NOT NULL DEFAULT 1,
      unit TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_okr_results_obj ON okr_results(objective_id);

    -- SLA (M5): definitions + events.
    CREATE TABLE IF NOT EXISTS sla_definitions (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      sla_type TEXT NOT NULL DEFAULT 'internal' CHECK(sla_type IN ('customer','internal','approval','support')),
      target_hours NUMERIC NOT NULL DEFAULT 24,
      priority TEXT,
      business_hours TEXT,        -- JSON BusinessHours
      holidays TEXT,              -- JSON string[]
      escalation TEXT,            -- JSON SlaEscalationRule[]
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS sla_events (
      id SERIAL PRIMARY KEY,
      sla_id INTEGER NOT NULL REFERENCES sla_definitions(id) ON DELETE CASCADE,
      ref_type TEXT,
      ref_id INTEGER,
      started_at TEXT NOT NULL DEFAULT (${NOW}),
      due_at TEXT,
      resolved_at TEXT,
      elapsed_hours NUMERIC,
      state TEXT NOT NULL DEFAULT 'within' CHECK(state IN ('within','due_soon','breached','resolved')),
      escalation_levels TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_sla_events_state ON sla_events(state, sla_id);

    -- Process metrics (M4): captured process-timeline snapshots.
    CREATE TABLE IF NOT EXISTS process_metrics (
      id SERIAL PRIMARY KEY,
      process TEXT NOT NULL,      -- sales/purchase/approval/payment/project
      period TEXT NOT NULL,
      transition TEXT,
      avg_hours NUMERIC,
      max_hours NUMERIC,
      case_count INTEGER,
      failure_rate_pct NUMERIC,
      performance_score NUMERIC,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_process_metrics ON process_metrics(process, period);

    -- Executive reports (M7): saved report configs/snapshots.
    CREATE TABLE IF NOT EXISTS executive_reports (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      audience TEXT NOT NULL DEFAULT 'ceo' CHECK(audience IN ('ceo','cfo','coo','sales','procurement','project')),
      config TEXT,
      currency TEXT NOT NULL DEFAULT 'IRR',
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Business alerts (M6): centralized alert store (all domains).
    CREATE TABLE IF NOT EXISTS business_alerts (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      domain TEXT NOT NULL CHECK(domain IN ('financial','operational','security')),
      severity TEXT NOT NULL DEFAULT 'warning' CHECK(severity IN ('info','warning','critical')),
      title_en TEXT NOT NULL,
      title_fa TEXT,
      detail TEXT,
      metric_value NUMERIC,
      ref_type TEXT,
      ref_id INTEGER,
      channels TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved')),
      fingerprint TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_biz_alerts_status ON business_alerts(status, domain, severity);

    -- Data quality checks (M9): last-run snapshots.
    CREATE TABLE IF NOT EXISTS data_quality_checks (
      id SERIAL PRIMARY KEY,
      check_key TEXT NOT NULL UNIQUE,
      label_en TEXT NOT NULL,
      label_fa TEXT,
      severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high')),
      affected INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      last_run TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Seed a couple of KPI definitions once (formula-driven).
    INSERT INTO kpi_definitions (code, name_en, name_fa, category, formula, unit, direction, target) VALUES
      ('gross_margin','Gross Margin','حاشیه سود ناخالص','financial','(revenue - cogs) / revenue * 100','%','higher_better',40),
      ('net_margin','Net Margin','حاشیه سود خالص','financial','net_income / revenue * 100','%','higher_better',15),
      ('inventory_turnover','Inventory Turnover','گردش موجودی','inventory','cogs / inventory_value','ratio','higher_better',4)
    ON CONFLICT (code) DO NOTHING;

    -- ═══════════════════════════════════════════════════════════════════════
    -- Phase 26.14 — Enterprise Treasury & Banking Platform
    -- ═══════════════════════════════════════════════════════════════════════
    -- Bank master (M1): EXTEND the existing bank_accounts (no duplicate table).
    ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS swift TEXT;
    ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS branch TEXT;
    ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS country TEXT;
    ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'current';
    ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS company_id INTEGER;
    ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

    -- Statement import batches (M2). bank_statement_lines = the transactions.
    CREATE TABLE IF NOT EXISTS bank_statements (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
      format TEXT NOT NULL DEFAULT 'csv' CHECK(format IN ('csv','excel','mt940','camt053','api')),
      period_from TEXT,
      period_to TEXT,
      line_count INTEGER NOT NULL DEFAULT 0,
      imported_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS statement_id INTEGER;
    ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS erp_type TEXT;
    ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS fingerprint TEXT;
    CREATE INDEX IF NOT EXISTS idx_stmt_lines_fp ON bank_statement_lines(fingerprint);

    -- Reconciliation matches (M3) with audit.
    CREATE TABLE IF NOT EXISTS bank_matches (
      id SERIAL PRIMARY KEY,
      statement_line_id BIGINT NOT NULL REFERENCES bank_statement_lines(id) ON DELETE CASCADE,
      erp_ref TEXT NOT NULL,          -- sales_payment:12 | purchase_payment:7 | payment_order:3
      confidence NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'suggested' CHECK(status IN ('suggested','matched','rejected')),
      reasons TEXT,
      matched_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_bank_matches_line ON bank_matches(statement_line_id, status);

    -- Payment orders (M4): full lifecycle, wired to the approval engine + GL.
    CREATE TABLE IF NOT EXISTS payment_orders (
      id SERIAL PRIMARY KEY,
      payment_no TEXT,
      payment_type TEXT NOT NULL CHECK(payment_type IN ('supplier_payment','customer_refund','internal_transfer','salary_payment','tax_payment','foreign_payment')),
      party TEXT,
      party_ref TEXT,                 -- vendor:5 / customer:3
      amount NUMERIC NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'IRR',
      exchange_rate NUMERIC NOT NULL DEFAULT 1,
      bank_account_id INTEGER REFERENCES bank_accounts(id),
      date TEXT NOT NULL,
      memo TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_approval','approved','processing','completed','rejected','cancelled')),
      approval_request_id INTEGER,
      gl_entry_id INTEGER,
      company_id INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status, date);

    -- Receipts (M5) with AR settlement allocations.
    CREATE TABLE IF NOT EXISTS receipt_transactions (
      id SERIAL PRIMARY KEY,
      receipt_no TEXT,
      receipt_type TEXT NOT NULL DEFAULT 'customer_receipt' CHECK(receipt_type IN ('customer_receipt','cash_receipt','card_receipt','foreign_receipt','advance_receipt')),
      customer_id INTEGER,
      amount NUMERIC NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'IRR',
      bank_account_id INTEGER REFERENCES bank_accounts(id),
      date TEXT NOT NULL,
      allocations TEXT NOT NULL DEFAULT '[]',   -- JSON [{invoiceId, amount}]
      advance NUMERIC NOT NULL DEFAULT 0,
      gl_entry_id INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_receipts_customer ON receipt_transactions(customer_id, date);

    -- Cash position snapshots (M7).
    CREATE TABLE IF NOT EXISTS cash_positions (
      id SERIAL PRIMARY KEY,
      as_of TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IRR',
      bank NUMERIC NOT NULL DEFAULT 0,
      cash NUMERIC NOT NULL DEFAULT 0,
      pending_receipts NUMERIC NOT NULL DEFAULT 0,
      pending_payments NUMERIC NOT NULL DEFAULT 0,
      projected NUMERIC NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Treasury liquidity forecasts (M8).
    CREATE TABLE IF NOT EXISTS treasury_forecasts (
      id SERIAL PRIMARY KEY,
      as_of TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IRR',
      buckets TEXT NOT NULL,          -- JSON LiquidityBucket[]
      risk TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    -- Currency exposures (M9).
    CREATE TABLE IF NOT EXISTS currency_exposures (
      id SERIAL PRIMARY KEY,
      as_of TEXT NOT NULL,
      currency TEXT NOT NULL,
      assets NUMERIC NOT NULL DEFAULT 0,
      liabilities NUMERIC NOT NULL DEFAULT 0,
      net_exposure NUMERIC NOT NULL DEFAULT 0,
      unrealized NUMERIC NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_currency_exp_asof ON currency_exposures(as_of, currency);

    -- Salaries expense account for payment GL posting (idempotent).
    INSERT INTO gl_accounts (code, name_en, name_fa, type) VALUES ('6100','Salaries','حقوق و دستمزد','expense') ON CONFLICT (code) DO NOTHING;
    -- Payment approval matrix (M4): <100M finance_manager, ≤1B cfo, >1B ceo (Toman tiers).
    INSERT INTO approval_matrix (doc_type, name_en, name_fa, min_amount, max_amount, levels) VALUES
      ('payment_request','Payment ≤ 100M','پرداخت تا ۱۰۰م',0,100000000,'[{"level":1,"mode":"all","approvers":[{"type":"role","ref":"finance_manager"}]}]'),
      ('payment_request','Payment 100M–1B','پرداخت ۱۰۰م تا ۱میلیارد',100000001,1000000000,'[{"level":1,"mode":"all","approvers":[{"type":"role","ref":"finance_manager"}]},{"level":2,"mode":"all","approvers":[{"type":"role","ref":"cfo"}]}]'),
      ('payment_request','Payment > 1B','پرداخت بالای ۱میلیارد',1000000001,NULL,'[{"level":1,"mode":"all","approvers":[{"type":"role","ref":"cfo"}]},{"level":2,"mode":"all","approvers":[{"type":"role","ref":"ceo"}]}]')
    ON CONFLICT DO NOTHING;


    -- Phase 24: cover hot structural/lookup foreign keys that participate in
    -- JOIN/WHERE (parent→child containment, tree parents, join tables, session
    -- and RBAC lookups). Audit-trail FKs (created_by/updated_by/author_id/
    -- owner_id/…) are intentionally left unindexed — they are almost never
    -- filtered on and indexing them only adds write cost + bloat.
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_hero_rules_hero ON hero_rules(hero_id);
    CREATE INDEX IF NOT EXISTS idx_page_sections_page ON page_sections(page_id);
    CREATE INDEX IF NOT EXISTS idx_page_sections_section ON page_sections(section_id);
    CREATE INDEX IF NOT EXISTS idx_section_versions_section ON section_versions(section_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);
    CREATE INDEX IF NOT EXISTS idx_course_lessons_course ON course_lessons(course_id);
    CREATE INDEX IF NOT EXISTS idx_pm_timesheets_task ON pm_timesheets(task_id);
    CREATE INDEX IF NOT EXISTS idx_gl_journal_period ON gl_journal_entries(period_id);
    CREATE INDEX IF NOT EXISTS idx_gl_accounts_parent ON gl_accounts(parent_id);
    CREATE INDEX IF NOT EXISTS idx_sales_documents_source ON sales_documents(source_id);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category_id);
    CREATE INDEX IF NOT EXISTS idx_content_category ON content(category_id);
    CREATE INDEX IF NOT EXISTS idx_content_product ON content(product_id);
    CREATE INDEX IF NOT EXISTS idx_docs_category ON docs(category_id);
    CREATE INDEX IF NOT EXISTS idx_docs_product ON docs(product_id);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id);
    CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id);
    CREATE INDEX IF NOT EXISTS idx_product_releases_product ON product_releases(product_id);
    CREATE INDEX IF NOT EXISTS idx_success_stories_org ON success_stories(organization_id);
    CREATE INDEX IF NOT EXISTS idx_inv_moves_location ON inv_moves(location_id);
    CREATE INDEX IF NOT EXISTS idx_numbering_audit_format ON numbering_audit(format_id);

    -- 26.23: reversal linkage (void on a posted entry books a mirror entry).
    ALTER TABLE gl_journal_entries ADD COLUMN IF NOT EXISTS reversal_of INTEGER;
    ALTER TABLE gl_journal_entries ADD COLUMN IF NOT EXISTS reversed_by INTEGER;
    -- 26.23: payments post to the GL too (Dr Bank/Cr AR · Dr AP/Cr Bank).
    ALTER TABLE sales_payments ADD COLUMN IF NOT EXISTS gl_entry_id INTEGER;
    ALTER TABLE purchase_payments ADD COLUMN IF NOT EXISTS gl_entry_id INTEGER;

    -- 26.23: default maker/checker matrix rule for journal posting (only
    -- consulted when erp_settings.gl_posting_approval = 'on').
    INSERT INTO approval_matrix (doc_type, name_en, name_fa, min_amount, levels, priority, active)
      SELECT 'journal_entry', 'Journal posting approval', 'تأیید ثبت سند حسابداری', 0,
             '[{"level":1,"mode":"any","approvers":[{"type":"role","ref":"administrator"},{"type":"role","ref":"super_admin"}]}]', 0, 1
      WHERE NOT EXISTS (SELECT 1 FROM approval_matrix WHERE doc_type='journal_entry');

    -- ═══════════════════════════════════════════════════════════════════════
    -- Phase 26.24 — Tenancy foundation (ADR-001, option b: multi-company).
    -- Every transactional table carries a nullable company_id (NULL = default
    -- company). Idempotent + non-breaking. audit:tenancy enforces this going
    -- forward. Reference/config tables stay shared (no company_id).
    -- ═══════════════════════════════════════════════════════════════════════
    ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS company_id INTEGER;
    ALTER TABLE sales_payments ADD COLUMN IF NOT EXISTS company_id INTEGER;
    ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS company_id INTEGER;
    ALTER TABLE purchase_payments ADD COLUMN IF NOT EXISTS company_id INTEGER;
    ALTER TABLE inv_moves ADD COLUMN IF NOT EXISTS company_id INTEGER;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS company_id INTEGER;
    ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS company_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_sales_docs_company ON sales_documents(company_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_docs_company ON purchase_documents(company_id);
    CREATE INDEX IF NOT EXISTS idx_inv_moves_company ON inv_moves(company_id);

    -- Phase 26.24 — سامانه مودیان (Iran Tax e-invoice queue). One row per sales
    -- document submitted to the tax authority; the payload is the standard
    -- electronic invoice, status tracks the delivery lifecycle.
    CREATE TABLE IF NOT EXISTS moadian_queue (
      id SERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES sales_documents(id) ON DELETE CASCADE,
      tax_id TEXT,                    -- شماره منحصربه‌فرد مالیاتی
      pattern TEXT NOT NULL DEFAULT '1' CHECK(pattern IN ('1','2')),  -- الگوی صورتحساب
      payload TEXT NOT NULL,          -- JSON standard invoice
      signature TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','confirmed')),
      reference_number TEXT,          -- شماره مرجع سازمان مالیاتی
      error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      company_id INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_moadian_status ON moadian_queue(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_moadian_doc ON moadian_queue(document_id);

    -- Phase 26.24 — payment gateway transactions (Zarrinpal/Saman/Mellat).
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id SERIAL PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'zarinpal',
      document_id INTEGER REFERENCES sales_documents(id) ON DELETE SET NULL,
      customer_id INTEGER REFERENCES sales_customers(id) ON DELETE SET NULL,
      amount NUMERIC NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IRR',
      authority TEXT,                 -- provider transaction handle
      ref_id TEXT,                    -- confirmed reference / RRN
      status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','pending','paid','verified','failed','canceled')),
      description TEXT,
      callback_url TEXT,
      sales_payment_id INTEGER,       -- linked once reconciled
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_paytx_authority ON payment_transactions(authority);
    CREATE INDEX IF NOT EXISTS idx_paytx_status ON payment_transactions(status);

    -- Phase 26.24: route/latency metrics roll-up (observability, بند ۲.۲).
    ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS moadian_status TEXT;

    -- ══ Phase 26.25 — CRM core + customer portal + tickets/SLA + campaigns ══
    -- بند ۱: customer payment terms (credit_limit already exists) + lead attribution.
    ALTER TABLE sales_customers ADD COLUMN IF NOT EXISTS payment_terms INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS campaign_id INTEGER;

    -- بند ۲: customer portal sessions — auth is INDEPENDENT of the admin JWT.
    -- OTP (sms) / magic-link (email); token_hash + otp_hash are sha256, never raw.
    CREATE TABLE IF NOT EXISTS customer_portal_sessions (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES sales_customers(id) ON DELETE CASCADE,
      channel TEXT NOT NULL DEFAULT 'otp' CHECK(channel IN ('otp','magic_link')),
      identifier TEXT NOT NULL,          -- phone or email the code was sent to
      otp_hash TEXT,                     -- sha256 of the 6-digit code (pre-verify)
      otp_expires_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      token_hash TEXT,                   -- sha256 of the session token (post-verify)
      verified INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,                   -- session expiry (post-verify)
      revoked INTEGER NOT NULL DEFAULT 0,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_portal_sess_token ON customer_portal_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_portal_sess_cust ON customer_portal_sessions(customer_id);

    -- بند ۳: support tickets + threaded messages + SLA linkage.
    CREATE TABLE IF NOT EXISTS crm_tickets (
      id SERIAL PRIMARY KEY,
      ticket_no TEXT UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES sales_customers(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','open','pending','resolved','closed')),
      owner_id TEXT,
      company_id INTEGER,
      sla_id INTEGER,
      first_response_at TEXT,
      resolved_at TEXT,
      source TEXT NOT NULL DEFAULT 'portal',
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_tickets_customer ON crm_tickets(customer_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON crm_tickets(status, priority);
    CREATE TABLE IF NOT EXISTS crm_ticket_messages (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES crm_tickets(id) ON DELETE CASCADE,
      author_kind TEXT NOT NULL DEFAULT 'agent' CHECK(author_kind IN ('agent','customer','system')),
      author_id TEXT,
      body TEXT NOT NULL,
      attachment_url TEXT,
      internal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_ticket_msgs ON crm_ticket_messages(ticket_id, created_at);
    -- 26.25b بند ۱: SLA clock accounting (pause while waiting on the customer).
    -- paused_hours accumulates business hours spent in 'pending'; pending_since is
    -- set when the ticket enters 'pending' and cleared (folded into paused_hours)
    -- when it leaves. sla_level tracks the highest escalation stage already fired.
    ALTER TABLE crm_tickets ADD COLUMN IF NOT EXISTS paused_hours NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE crm_tickets ADD COLUMN IF NOT EXISTS pending_since TEXT;
    ALTER TABLE crm_tickets ADD COLUMN IF NOT EXISTS sla_level INTEGER NOT NULL DEFAULT 0;
    -- 26.25b بند ۱: portal knowledge base reuses ai_knowledge_base (NO new CMS) —
    -- a public flag opts an article into the customer-facing help center.
    ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS portal_public INTEGER NOT NULL DEFAULT 0;

    -- بند ۴: campaigns + recipients (send queue with retry) + consent/opt-out.
    CREATE TABLE IF NOT EXISTS crm_campaigns (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'sms' CHECK(channel IN ('sms','email')),
      subject TEXT,
      body TEXT NOT NULL DEFAULT '',
      utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
      budget NUMERIC NOT NULL DEFAULT 0,
      cost NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sending','paused','done','canceled')),
      company_id INTEGER,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS crm_campaign_recipients (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES crm_campaigns(id) ON DELETE CASCADE,
      customer_id INTEGER,
      lead_id INTEGER,
      target TEXT NOT NULL,              -- phone or email
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent','failed','skipped_optout')),
      error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      company_id INTEGER,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_recip ON crm_campaign_recipients(campaign_id, status);
    -- Opt-out registry: a server-side block list, matched by channel + target.
    CREATE TABLE IF NOT EXISTS crm_optouts (
      id SERIAL PRIMARY KEY,
      channel TEXT NOT NULL CHECK(channel IN ('sms','email')),
      target TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE(channel, target)
    );

    -- 26.25 settings seeds (idempotent): credit guard mode + SMS provider config.
    INSERT INTO erp_settings (key, value) VALUES
      ('credit_guard_mode','warn'),
      ('sms_provider','kavenegar'),
      ('sms_api_key',''),
      ('sms_sender','')
    ON CONFLICT (key) DO NOTHING;

    -- ══ Phase 26.25s — multi-channel campaigns (sms · email · whatsapp · telegram) ══
    -- بند ۴.۲: per-customer channel registry (chat_id filled only via /start).
    CREATE TABLE IF NOT EXISTS crm_customer_channels (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES sales_customers(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK(channel IN ('sms','email','whatsapp','telegram')),
      address TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      opt_in INTEGER NOT NULL DEFAULT 1,
      consent_basis TEXT,
      opt_out_at TEXT,
      last_inbound_at TEXT,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE(channel, address)
    );
    CREATE INDEX IF NOT EXISTS idx_cust_channels_cust ON crm_customer_channels(customer_id);
    -- Idempotent backfill: existing customer phone/email → sms/email channels.
    INSERT INTO crm_customer_channels (customer_id, channel, address, opt_in, consent_basis, updated_at)
      SELECT id, 'sms', phone, 1, 'existing_customer', ${NOW} FROM sales_customers
      WHERE phone IS NOT NULL AND phone<>'' ON CONFLICT (channel, address) DO NOTHING;
    INSERT INTO crm_customer_channels (customer_id, channel, address, opt_in, consent_basis, updated_at)
      SELECT id, 'email', email, 1, 'existing_customer', ${NOW} FROM sales_customers
      WHERE email IS NOT NULL AND email<>'' ON CONFLICT (channel, address) DO NOTHING;

    -- بند ۴.۴ migration: campaigns go multi-channel (keep the old single column).
    ALTER TABLE crm_campaigns ADD COLUMN IF NOT EXISTS channels TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE crm_campaigns ADD COLUMN IF NOT EXISTS fallback_chain TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE crm_campaigns ADD COLUMN IF NOT EXISTS templates TEXT NOT NULL DEFAULT '{}';
    UPDATE crm_campaigns SET channels = ('["' || channel || '"]') WHERE channels = '[]' AND channel IS NOT NULL;
    ALTER TABLE crm_campaign_recipients ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'sms';
    ALTER TABLE crm_campaign_recipients ADD COLUMN IF NOT EXISTS reason TEXT;
    ALTER TABLE crm_campaign_recipients ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
    ALTER TABLE crm_campaign_recipients ADD COLUMN IF NOT EXISTS queued_at TEXT;
    ALTER TABLE crm_campaign_recipients ADD COLUMN IF NOT EXISTS delivered_at TEXT;
    ALTER TABLE crm_campaign_recipients ADD COLUMN IF NOT EXISTS read_at TEXT;
    ALTER TABLE crm_campaign_recipients ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE crm_campaign_recipients DROP CONSTRAINT IF EXISTS crm_campaign_recipients_status_check;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_recip ON crm_campaign_recipients(campaign_id, customer_id, channel);
    -- 26.25b بند ۰.۷: the 26.25s migration DROPped the source CHECK to let
    -- inbound_* leads in, which left the column accepting ANY string (no DB-level
    -- guard, so a poisoned webhook could store arbitrary garbage sources). Restore
    -- an EXPLICIT allow-list that now also includes the inbound_* channel sources.
    -- Idempotent: normalise any stray value, then (re)create the named constraint.
    UPDATE crm_leads SET source = 'other'
      WHERE source NOT IN ('website','referral','consultation','contact_form','event','social','email','other',
                           'inbound_whatsapp','inbound_telegram','inbound_sms','inbound_email','campaign');
    ALTER TABLE crm_leads DROP CONSTRAINT IF EXISTS crm_leads_source_check;
    ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_source_check CHECK (source IN (
      'website','referral','consultation','contact_form','event','social','email','other',
      'inbound_whatsapp','inbound_telegram','inbound_sms','inbound_email','campaign'));

    -- 26.25b بند ۰.۴: add a distinct 'gateway' payment method so an online
    -- payment-gateway settlement is NOT recorded as a physical POS 'card' swipe
    -- (that ambiguity broke reconciliation). Fix historical gateway-path rows using
    -- payment_transactions as evidence — never touch a real POS 'card' record.
    ALTER TABLE sales_payments DROP CONSTRAINT IF EXISTS sales_payments_method_check;
    ALTER TABLE sales_payments ADD CONSTRAINT sales_payments_method_check
      CHECK (method IN ('cash','bank','card','cheque','gateway','refund','other'));
    -- 26.26 BUG-013: sales-return settlement policy — 'refund' pays money back
    -- (a negative sales_payment + GL Dr AR/Cr Bank → AR back to 0); 'credit' leaves
    -- the customer credit balance and raises a pending-settlement alert.
    INSERT INTO erp_settings (key, value) VALUES ('sales_return_settlement','credit')
    ON CONFLICT (key) DO NOTHING;
    UPDATE sales_payments p SET method = 'gateway'
      WHERE p.method = 'card' AND EXISTS (
        SELECT 1 FROM payment_transactions t
        WHERE t.sales_payment_id = p.id AND t.status IN ('paid','verified'));

    -- 26.25s settings seeds (idempotent): whatsapp + telegram provider config.
    INSERT INTO erp_settings (key, value) VALUES
      ('whatsapp_token',''), ('whatsapp_phone_id',''), ('whatsapp_verify_token',''), ('whatsapp_app_secret',''),
      ('telegram_bot_token',''), ('telegram_webhook_secret','')
    ON CONFLICT (key) DO NOTHING;

    -- 26.25b بند ۰.۶: inbound-lead flood control. Unknown-sender inbound is
    -- QUARANTINED here (pending_review) and never enters the CRM funnel/CAC until
    -- an operator confirms; a per-window rate cap blocks excess (status='blocked').
    CREATE TABLE IF NOT EXISTS crm_inbound_messages (
      id SERIAL PRIMARY KEY,
      channel TEXT NOT NULL,
      address TEXT NOT NULL,
      body TEXT,
      status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK(status IN ('pending_review','confirmed','rejected','blocked')),
      lead_id INTEGER,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_inbound_status ON crm_inbound_messages(status);
    CREATE INDEX IF NOT EXISTS idx_inbound_window ON crm_inbound_messages(channel, created_at);
    INSERT INTO erp_settings (key, value) VALUES
      ('inbound_cap_global','200'), ('inbound_cap_channel','100'), ('inbound_cap_window','60')
    ON CONFLICT (key) DO NOTHING;

    -- ── Phase 26.27: tree RBAC (grants/ops/scopes/templates/audit) ──────────
    CREATE TABLE IF NOT EXISTS rbac_user_grants (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission_key TEXT NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('none','read','write')),
      company_id INTEGER,
      granted_by TEXT,
      granted_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE(user_id, permission_key, company_id)
    );
    CREATE INDEX IF NOT EXISTS idx_rbac_grants_user ON rbac_user_grants(user_id);
    CREATE TABLE IF NOT EXISTS rbac_user_ops (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      op_key TEXT NOT NULL,
      allowed BOOLEAN NOT NULL DEFAULT true,
      company_id INTEGER,
      granted_by TEXT,
      granted_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE(user_id, op_key, company_id)
    );
    CREATE INDEX IF NOT EXISTS idx_rbac_ops_user ON rbac_user_ops(user_id);
    CREATE TABLE IF NOT EXISTS rbac_row_scope (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission_key TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'all' CHECK(scope IN ('all','own','department','company')),
      company_id INTEGER,
      UNIQUE(user_id, permission_key, company_id)
    );
    CREATE TABLE IF NOT EXISTS rbac_role_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      name_fa TEXT NOT NULL,
      grants TEXT NOT NULL DEFAULT '{}',
      ops TEXT NOT NULL DEFAULT '{}',
      row_scopes TEXT NOT NULL DEFAULT '{}',
      is_system BOOLEAN NOT NULL DEFAULT false,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE TABLE IF NOT EXISTS rbac_audit (
      id SERIAL PRIMARY KEY,
      actor_id TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_rbac_audit_target ON rbac_audit(target_user_id);
    -- بند ۴: seeded role templates (system templates; apply-then-customize)
    INSERT INTO rbac_role_templates (name, name_fa, grants, ops, row_scopes, is_system) VALUES
      ('CEO', 'مدیرعامل', '{"executive":"read","erp":"read","crm":"read","analytics":"read","brand":"read","content":"read","documentation":"read"}', '{}', '{}', true),
      ('CFO', 'مدیر مالی', '{"erp":"write","executive":"read","analytics":"read","system":"none","backup":"none"}', '{"erp.finance:post":true,"erp.finance:void":true,"erp.finance:delete":true,"erp.finance:close_period":true,"erp.finance:reopen_period":true,"erp.sales:confirm":true,"erp.sales:void":true,"erp.sales:return":true,"erp.sales:post":true,"erp.sales:payment_create":true,"erp.sales:refund":true,"erp.purchasing:confirm":true,"erp.purchasing:void":true,"erp.purchasing:post":true,"erp.treasury:reconcile":true,"erp.treasury:cheque_state":true,"erp.approvals:approve":true,"erp.approvals:reject":true,"erp.moadian:submit":true}', '{}', true),
      ('Finance Specialist', 'کارشناس مالی', '{"erp.finance":"write","erp.sales":"write","erp.purchasing":"write","erp.inventory":"read","executive":"read"}', '{"erp.finance:post":false,"erp.sales:confirm":false,"erp.purchasing:confirm":false}', '{}', true),
      ('Auditor', 'حسابرس', '{"executive":"read","erp":"read","crm":"read","analytics":"read","security":"read","operations":"read","brand":"read","content":"read","documentation":"read"}', '{}', '{}', true),
      ('HR Manager', 'مدیر منابع انسانی', '{"system.organization":"write","crm":"read","executive":"read"}', '{}', '{}', true),
      ('Marketing Manager', 'مدیر مارکتینگ', '{"crm":"write","brand":"write","content":"write","analytics":"read","executive":"read"}', '{}', '{}', true),
      ('IT Manager', 'مدیر IT', '{"system":"write","security":"write","backup":"write","operations":"write","ai":"write","executive":"read"}', '{}', '{}', true),
      ('Shareholder', 'سهامدار', '{"executive":"read","analytics":"read","erp":"none","crm":"none","system":"none","security":"none","backup":"none","operations":"none","brand":"none","content":"none","ai":"none","documentation":"none"}', '{}', '{}', true),
      ('Employee', 'کارمند', '{"executive":"read","crm.crm.tickets":"write","erp":"none","system":"none","security":"none","backup":"none"}', '{}', '{"crm.crm.tickets":"own"}', true)
    ON CONFLICT (name) DO NOTHING;

    -- 26.28: NULL company_id defeats the plain UNIQUE constraint (SQL NULLs are
    -- distinct) → duplicates were possible. Dedupe (keep the newest row) and add
    -- NULL-safe unique indexes so the invariant holds at the DB level too.
    DELETE FROM rbac_user_grants a USING rbac_user_grants b
      WHERE a.id < b.id AND a.user_id=b.user_id AND a.permission_key=b.permission_key
        AND a.company_id IS NOT DISTINCT FROM b.company_id;
    DELETE FROM rbac_user_ops a USING rbac_user_ops b
      WHERE a.id < b.id AND a.user_id=b.user_id AND a.op_key=b.op_key
        AND a.company_id IS NOT DISTINCT FROM b.company_id;
    DELETE FROM rbac_row_scope a USING rbac_row_scope b
      WHERE a.id < b.id AND a.user_id=b.user_id AND a.permission_key=b.permission_key
        AND a.company_id IS NOT DISTINCT FROM b.company_id;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_rbac_grants_nullsafe ON rbac_user_grants(user_id, permission_key, COALESCE(company_id,-1));
    CREATE UNIQUE INDEX IF NOT EXISTS uq_rbac_ops_nullsafe ON rbac_user_ops(user_id, op_key, COALESCE(company_id,-1));
    CREATE UNIQUE INDEX IF NOT EXISTS uq_rbac_scope_nullsafe ON rbac_row_scope(user_id, permission_key, COALESCE(company_id,-1));

    -- 26.32: repoint an existing install's dispatch FK from the colliding CMS
    -- "integrations" table to the real connector table (idempotent, no-op when
    -- it already points at the right place).
    DO $fk2632$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'integration_dispatches_connector_id_fkey'
          AND confrelid = 'integrations'::regclass
      ) THEN
        ALTER TABLE integration_dispatches DROP CONSTRAINT integration_dispatches_connector_id_fkey;
        ALTER TABLE integration_dispatches
          ADD CONSTRAINT integration_dispatches_connector_id_fkey
          FOREIGN KEY (connector_id) REFERENCES integration_connectors(id) ON DELETE CASCADE;
      END IF;
    EXCEPTION WHEN undefined_table THEN NULL;
    END
    $fk2632$;

    -- ── Phase 26.29 بند ۰: RBAC key migration after the menu reorganisation ──
    -- The permission tree is GENERATED from WORKSPACES, so moving a module to a
    -- different workspace changes its key and would silently orphan every stored
    -- grant (the user would just lose access, with no error anywhere). This
    -- remaps them. Idempotent: the old keys no longer exist after the first run,
    -- and each statement is a no-op when there is nothing to move. The
    -- ON CONFLICT-free form is required because company_id may be NULL (26.28).
    DO $rbac2629$
    DECLARE
      m RECORD;
    BEGIN
      FOR m IN SELECT * FROM (VALUES
        ('analytics.ai-analytics','ai.ai-analytics'),
        ('analytics.dashboard','executive.dashboard'),
        ('analytics.reports','erp.reports'),
        ('analytics.seo','brand.seo'),
        ('content.ai-kb','ai.ai-kb'),
        ('content.ai-prompts','ai.ai-prompts'),
        ('content.blog','brand.blog'),
        ('content.content','brand.content'),
        ('content.docs','brand.docs'),
        ('content.media','brand.media'),
        ('documentation.docs','brand.docs'),
        ('crm.crm.tickets','operations.crm.tickets'),
        ('erp.numbering','system.numbering'),
        ('security.flags','system.flags'),
        ('system.company','erp.company'),
        ('system.logs-monitoring','operations.logs-monitoring'),
        ('system.security','security.security'),
        ('system.seo','brand.seo'),
        -- workspace-level grants of the three merged workspaces
        ('analytics','executive'),
        ('content','brand'),
        ('documentation','brand')
      ) AS t(old_key, new_key) LOOP
        -- drop a row that would collide with an existing grant on the new key
        DELETE FROM rbac_user_grants g USING rbac_user_grants k
          WHERE g.permission_key = m.old_key AND k.permission_key = m.new_key
            AND g.user_id = k.user_id AND g.company_id IS NOT DISTINCT FROM k.company_id;
        UPDATE rbac_user_grants SET permission_key = m.new_key WHERE permission_key = m.old_key;

        DELETE FROM rbac_row_scope g USING rbac_row_scope k
          WHERE g.permission_key = m.old_key AND k.permission_key = m.new_key
            AND g.user_id = k.user_id AND g.company_id IS NOT DISTINCT FROM k.company_id;
        UPDATE rbac_row_scope SET permission_key = m.new_key WHERE permission_key = m.old_key;

        -- sensitive ops carry the module key as a prefix ("<module>:<op>")
        DELETE FROM rbac_user_ops g USING rbac_user_ops k
          WHERE g.op_key LIKE m.old_key || ':%'
            AND k.op_key = m.new_key || split_part(g.op_key, ':', 2)
            AND g.user_id = k.user_id AND g.company_id IS NOT DISTINCT FROM k.company_id;
        UPDATE rbac_user_ops SET op_key = m.new_key || ':' || split_part(op_key, ':', 2)
          WHERE op_key LIKE m.old_key || ':%';
      END LOOP;
    END
    $rbac2629$;

    -- ── Phase 26.33 BUG-204: Currency/Document settings had a SECOND menu entry
    -- under the System workspace, which (per the 26.29 key rule) meant a second
    -- permission key. Removing the duplicate menu items would silently orphan
    -- every grant stored against those keys, so they migrate to the ERP owners.
    -- Same idempotent, NULL-safe, collision-deduping form as $rbac2629$.
    DO $rbac2633$
    DECLARE
      m RECORD;
    BEGIN
      FOR m IN SELECT * FROM (VALUES
        ('system.finance','erp.finance'),
        ('system.documents','erp.documents')
      ) AS t(old_key, new_key) LOOP
        DELETE FROM rbac_user_grants g USING rbac_user_grants k
          WHERE g.permission_key = m.old_key AND k.permission_key = m.new_key
            AND g.user_id = k.user_id AND g.company_id IS NOT DISTINCT FROM k.company_id;
        UPDATE rbac_user_grants SET permission_key = m.new_key WHERE permission_key = m.old_key;

        DELETE FROM rbac_row_scope g USING rbac_row_scope k
          WHERE g.permission_key = m.old_key AND k.permission_key = m.new_key
            AND g.user_id = k.user_id AND g.company_id IS NOT DISTINCT FROM k.company_id;
        UPDATE rbac_row_scope SET permission_key = m.new_key WHERE permission_key = m.old_key;

        DELETE FROM rbac_user_ops g USING rbac_user_ops k
          WHERE g.op_key LIKE m.old_key || ':%'
            AND k.op_key = m.new_key || split_part(g.op_key, ':', 2)
            AND g.user_id = k.user_id AND g.company_id IS NOT DISTINCT FROM k.company_id;
        UPDATE rbac_user_ops SET op_key = m.new_key || ':' || split_part(op_key, ':', 2)
          WHERE op_key LIKE m.old_key || ':%';
      END LOOP;
    END
    $rbac2633$;

    -- ── Phase 26.27 بند ۵: 2FA hardening ────────────────────────────────────
    CREATE TABLE IF NOT EXISTS admin_recovery_codes (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON admin_recovery_codes(user_id);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_fail_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_locked_until TEXT;
    -- بند ۵.۵ policy switch (OFF by default → R5 backward compat + E2E unchanged)
    INSERT INTO erp_settings (key, value) VALUES ('2fa_required_sensitive','0')
    ON CONFLICT (key) DO NOTHING;

    -- ── Phase 26.27 بند ۶ ABAC: customer ownership for row scope (scope=own) ──
    ALTER TABLE sales_customers ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id);
    UPDATE sales_customers c SET owner_id = l.owner_id
      FROM crm_leads l
      WHERE c.owner_id IS NULL AND l.converted_customer_id = c.id AND l.owner_id IS NOT NULL;

    -- بند ۰.۱: role_assignments was a dormant Phase-7 skeleton (role-per-scope
    -- model, zero call sites). Its shape does not fit node-level tree grants —
    -- dropped so one model remains (decision (ب), recorded in the phase report).
    DROP TABLE IF EXISTS role_assignments;

    -- 26.22 (runs LAST so every seeded account exists): attach each leaf
    -- account to its Iranian-coding گروه root by leading digit (idempotent).
    UPDATE gl_accounts a SET parent_id = g.id
      FROM gl_accounts g
      WHERE a.parent_id IS NULL AND length(a.code) > 1 AND length(g.code) = 1
        AND g.code = left(a.code, 1);
    -- ── Phase 27 بند۱: Opportunity as a first-class entity ──────────────────
    -- Deal value used to live on the lead itself, which cannot express what a
    -- real customer looks like: one account with SEVERAL open deals at once (a
    -- network project AND a support contract). A lead is a person/company you
    -- are qualifying; an opportunity is a deal you are working.
    CREATE TABLE IF NOT EXISTS crm_opportunities (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES sales_customers(id) ON DELETE SET NULL,
      lead_id INTEGER REFERENCES crm_leads(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'IRR',
      probability INTEGER NOT NULL DEFAULT 10 CHECK(probability BETWEEN 0 AND 100),
      stage TEXT NOT NULL DEFAULT 'identified'
        CHECK(stage IN ('identified','qualified','proposal','negotiation','won','lost')),
      expected_close_date TEXT,
      owner_id TEXT REFERENCES users(id),
      -- why it was won or lost: the input the loss analysis in بند۴ reads
      outcome_reason TEXT,
      -- two-way link to the sales document a won opportunity became
      sales_document_id INTEGER,
      notes TEXT,
      company_id INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_crm_opp_customer ON crm_opportunities(customer_id);
    CREATE INDEX IF NOT EXISTS idx_crm_opp_stage ON crm_opportunities(stage);
    CREATE INDEX IF NOT EXISTS idx_crm_opp_owner ON crm_opportunities(owner_id);

    -- Optional proposed lines, so a won opportunity converts straight into a
    -- quotation/invoice instead of being re-typed.
    CREATE TABLE IF NOT EXISTS crm_opportunity_items (
      id SERIAL PRIMARY KEY,
      opportunity_id INTEGER NOT NULL REFERENCES crm_opportunities(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      qty NUMERIC(18,3) NOT NULL DEFAULT 1,
      unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
      discount_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
      tax_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
      product_id INTEGER,
      line_no INTEGER NOT NULL DEFAULT 0,
      company_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_crm_opp_items ON crm_opportunity_items(opportunity_id);

    -- ── Phase 27 بند۲: loyalty club ─────────────────────────────────────────
    -- Points are a LIABILITY, not decoration: every point earned is a discount
    -- the company owes. So the balance is never written directly — it is the
    -- sum of an append-only ledger, exactly like the GL. That is what makes a
    -- reversal possible when the originating invoice is returned.
    CREATE TABLE IF NOT EXISTS loyalty_programs (
      id SERIAL PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'points' CHECK(kind IN ('points','tier','hybrid')),
      -- points earned per 1 unit of invoice value
      earn_rate NUMERIC(12,6) NOT NULL DEFAULT 0.001,
      -- currency value of one point when redeemed
      redeem_rate NUMERIC(12,6) NOT NULL DEFAULT 1,
      points_expire_days INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS loyalty_tiers (
      id SERIAL PRIMARY KEY,
      program_id INTEGER NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      threshold NUMERIC(18,2) NOT NULL DEFAULT 0,
      discount_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
      benefits_en TEXT,
      benefits_fa TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_program ON loyalty_tiers(program_id);

    CREATE TABLE IF NOT EXISTS loyalty_accounts (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES sales_customers(id) ON DELETE CASCADE,
      program_id INTEGER NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
      -- a CACHE of the ledger, refreshed from it; never the source of truth
      balance NUMERIC(18,2) NOT NULL DEFAULT 0,
      total_earned NUMERIC(18,2) NOT NULL DEFAULT 0,
      total_spent NUMERIC(18,2) NOT NULL DEFAULT 0,
      tier_id INTEGER REFERENCES loyalty_tiers(id) ON DELETE SET NULL,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW}),
      UNIQUE(customer_id, program_id)
    );

    -- The ledger. The points column is signed: earn positive, redeem/expire/
    -- reversal negative. ref_type/ref_id tie every movement to its source
    -- document, which is what makes "why do I have these points?" answerable.
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('earn','redeem','expire','adjust','reversal')),
      points NUMERIC(18,2) NOT NULL,
      ref_type TEXT,
      ref_id INTEGER,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_loyalty_tx_account ON loyalty_transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_loyalty_tx_ref ON loyalty_transactions(ref_type, ref_id);

    CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'percent' CHECK(kind IN ('percent','amount')),
      value NUMERIC(18,2) NOT NULL DEFAULT 0,
      min_order_total NUMERIC(18,2) NOT NULL DEFAULT 0,
      max_redemptions INTEGER,
      max_per_customer INTEGER NOT NULL DEFAULT 1,
      valid_from TEXT,
      valid_until TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      company_id INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id SERIAL PRIMARY KEY,
      coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES sales_customers(id) ON DELETE SET NULL,
      sales_document_id INTEGER,
      discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions ON coupon_redemptions(coupon_id, customer_id);

    -- Cashback has a real accounting effect, so the GL mapping is configurable
    -- and DEFAULTS TO OFF until an accountant decides which accounts to use.
    INSERT INTO erp_settings (key, value)
    SELECT * FROM (VALUES
      ('loyalty_gl_enabled','0'),
      ('loyalty_gl_expense','6900'),
      ('loyalty_gl_liability','2900')
    ) AS v(k,val)
    WHERE NOT EXISTS (SELECT 1 FROM erp_settings s WHERE s.key = v.k);

    -- ══ Phase 28.1: HR — people and their employment record ═════════════════
    -- HR data is the most sensitive the organisation holds (salary, national
    -- id, bank account), so the sensitive columns live here but are stripped
    -- from API responses without an explicit grant (R8 / 26.28 field scope).
    CREATE TABLE IF NOT EXISTS hr_employees (
      id SERIAL PRIMARY KEY,
      employee_code TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      -- sensitive: national id, bank details
      national_id TEXT UNIQUE,
      iban TEXT,
      bank_account TEXT,
      birth_date TEXT,
      gender TEXT CHECK(gender IN ('male','female','other')),
      marital_status TEXT CHECK(marital_status IN ('single','married','divorced','widowed')),
      children_count INTEGER NOT NULL DEFAULT 0,
      insurance_no TEXT,
      mobile TEXT,
      email TEXT,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','on_leave','terminated')),
      hire_date TEXT,
      end_date TEXT,
      -- optional link to an admin login; an employee need not have one
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      department_id INTEGER,
      notes TEXT,
      company_id INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_emp_status ON hr_employees(status);
    CREATE INDEX IF NOT EXISTS idx_hr_emp_dept ON hr_employees(department_id);

    CREATE TABLE IF NOT EXISTS hr_positions (
      id SERIAL PRIMARY KEY,
      title_en TEXT NOT NULL,
      title_fa TEXT NOT NULL,
      department_id INTEGER,
      level INTEGER NOT NULL DEFAULT 1,
      description_en TEXT,
      description_fa TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      company_id INTEGER
    );

    -- APPEND-ONLY employment history. A salary change or a promotion writes a
    -- NEW row and closes the previous one; nothing is overwritten, because this
    -- table is the basis for severance (سنوات) and payroll back-calculation.
    -- Same discipline as the GL and the loyalty ledger.
    CREATE TABLE IF NOT EXISTS hr_employment (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      position_id INTEGER REFERENCES hr_positions(id) ON DELETE SET NULL,
      contract_type TEXT NOT NULL DEFAULT 'contract'
        CHECK(contract_type IN ('permanent','fixed_term','contract','hourly','intern')),
      start_date TEXT NOT NULL,
      end_date TEXT,
      base_salary NUMERIC(18,2) NOT NULL DEFAULT 0,
      work_location TEXT,
      manager_id INTEGER REFERENCES hr_employees(id) ON DELETE SET NULL,
      change_reason TEXT,
      company_id INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_employment_emp ON hr_employment(employee_id, start_date DESC);

    -- Personnel documents: the FILE lives in media_files (reused); only the
    -- metadata and the HR meaning of it live here.
    CREATE TABLE IF NOT EXISTS hr_documents (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'other'
        CHECK(kind IN ('id_card','birth_certificate','education','contract','military','insurance','other')),
      title TEXT NOT NULL,
      media_url TEXT,
      issued_at TEXT,
      expires_at TEXT,
      company_id INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_documents_emp ON hr_documents(employee_id);

    -- Dependents drive tax relief and insurance entitlement, so they are a
    -- payroll input, not an address-book nicety.
    CREATE TABLE IF NOT EXISTS hr_dependents (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'child'
        CHECK(relation IN ('spouse','child','parent','other')),
      national_id TEXT,
      birth_date TEXT,
      is_dependent INTEGER NOT NULL DEFAULT 1,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_dependents_emp ON hr_dependents(employee_id);

    -- ══ Phase 28.2: leave, attendance, missions ═════════════════════════════
    -- Iranian public holidays MOVE every year, so they are data the operator
    -- maintains — never a hardcoded list that silently rots.
    CREATE TABLE IF NOT EXISTS hr_holidays (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      title_fa TEXT NOT NULL,
      title_en TEXT,
      kind TEXT NOT NULL DEFAULT 'public' CHECK(kind IN ('public','religious','company')),
      company_id INTEGER,
      UNIQUE(date, company_id)
    );
    CREATE INDEX IF NOT EXISTS idx_hr_holidays_date ON hr_holidays(date);

    -- The organisation's working week. In Iran Friday is the weekly rest day
    -- and Thursday is commonly a half or non-working day — so it is settings,
    -- not an assumption baked into a function.
    CREATE TABLE IF NOT EXISTS hr_work_calendar (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'default',
      -- 0=Saturday … 6=Friday (Iranian week order)
      working_days TEXT NOT NULL DEFAULT '0,1,2,3,4',
      daily_hours NUMERIC(5,2) NOT NULL DEFAULT 8,
      company_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1
    );
    INSERT INTO hr_work_calendar (name, working_days, daily_hours)
    SELECT 'default', '0,1,2,3,4', 8
    WHERE NOT EXISTS (SELECT 1 FROM hr_work_calendar);

    CREATE TABLE IF NOT EXISTS hr_leave_types (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      paid INTEGER NOT NULL DEFAULT 1,
      -- days accrued per month; the labour-law default is 2.5 but it is
      -- configurable because contracts differ
      accrual_per_month NUMERIC(6,2) NOT NULL DEFAULT 0,
      max_days_per_year NUMERIC(6,2),
      requires_document INTEGER NOT NULL DEFAULT 0,
      deducts_balance INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      company_id INTEGER
    );
    INSERT INTO hr_leave_types (code, name_en, name_fa, paid, accrual_per_month, requires_document, deducts_balance)
    SELECT * FROM (VALUES
      ('annual','Annual leave','مرخصی استحقاقی',1,2.5,0,1),
      ('sick','Sick leave','مرخصی استعلاجی',1,0,1,0),
      ('unpaid','Unpaid leave','مرخصی بدون حقوق',0,0,0,0),
      ('maternity','Maternity leave','مرخصی زایمان',1,0,1,0),
      ('marriage','Marriage leave','مرخصی ازدواج',1,0,1,0),
      ('bereavement','Bereavement leave','مرخصی فوت بستگان',1,0,0,0)
    ) AS v(a,b,c,d,e,f,g)
    WHERE NOT EXISTS (SELECT 1 FROM hr_leave_types);

    -- LEDGER, not a balance column (the 27 lesson): every accrual, use,
    -- carry-over, payout and reversal is a signed row, so a cancelled leave can
    -- be given back and the balance always explains itself.
    CREATE TABLE IF NOT EXISTS hr_leave_transactions (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      leave_type_id INTEGER NOT NULL REFERENCES hr_leave_types(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('accrual','use','carry_over','payout','adjust','reversal')),
      days NUMERIC(8,2) NOT NULL,
      ref_type TEXT,
      ref_id INTEGER,
      period TEXT,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_leave_tx ON hr_leave_transactions(employee_id, leave_type_id);
    CREATE INDEX IF NOT EXISTS idx_hr_leave_tx_ref ON hr_leave_transactions(ref_type, ref_id);

    CREATE TABLE IF NOT EXISTS hr_leave_requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      leave_type_id INTEGER NOT NULL REFERENCES hr_leave_types(id),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days NUMERIC(8,2) NOT NULL DEFAULT 0,
      half_day INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft','pending','approved','rejected','cancelled')),
      approval_request_id INTEGER,
      decided_by TEXT REFERENCES users(id),
      decided_at TEXT,
      company_id INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_leave_req ON hr_leave_requests(employee_id, status);

    CREATE TABLE IF NOT EXISTS hr_attendance (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','device','self')),
      late_minutes INTEGER NOT NULL DEFAULT 0,
      early_leave_minutes INTEGER NOT NULL DEFAULT 0,
      worked_minutes INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      company_id INTEGER,
      created_by TEXT REFERENCES users(id),
      UNIQUE(employee_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_hr_attendance ON hr_attendance(employee_id, date);

    -- Overtime is a direct payroll input, so its KIND matters: the statutory
    -- multiplier differs for ordinary, holiday and night work.
    CREATE TABLE IF NOT EXISTS hr_overtime (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      hours NUMERIC(6,2) NOT NULL,
      kind TEXT NOT NULL DEFAULT 'normal' CHECK(kind IN ('normal','holiday','night')),
      approved INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      company_id INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_overtime ON hr_overtime(employee_id, date);

    CREATE TABLE IF NOT EXISTS hr_missions (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      destination TEXT NOT NULL,
      purpose TEXT,
      estimated_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
      actual_cost NUMERIC(18,2),
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft','pending','approved','rejected','completed')),
      petty_cash_entry_id INTEGER,
      company_id INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_missions ON hr_missions(employee_id, status);

    -- 28.2: a default approval rule for leave.
    --
    -- The approval engine auto-approves a document type it has NO rule for.
    -- That default is wrong for absence: leave must default to "needs a
    -- decision", not to "granted", or a request is approved the moment it is
    -- typed and no manager ever sees it. The rule is editable in the Approval
    -- Center like any other.
    INSERT INTO approval_matrix (doc_type, name_en, name_fa, min_amount, levels, priority, active)
      SELECT 'leave_request', 'Leave approval', 'تأیید مرخصی', 0,
             '[{"level":1,"mode":"any","approvers":[{"type":"role","ref":"administrator"},{"type":"role","ref":"super_admin"}]}]', 0, 1
      WHERE NOT EXISTS (SELECT 1 FROM approval_matrix WHERE doc_type='leave_request');



    -- Configurable loss reasons (بند۱) — a free-text reason cannot be analysed.
    CREATE TABLE IF NOT EXISTS crm_loss_reasons (
      id SERIAL PRIMARY KEY,
      label_en TEXT NOT NULL,
      label_fa TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO crm_loss_reasons (label_en, label_fa, sort_order)
    SELECT * FROM (VALUES
      ('Price too high','قیمت بالا',1),
      ('Lost to competitor','انتخاب رقیب',2),
      ('No budget','نبود بودجه',3),
      ('Timing / postponed','زمان‌بندی نامناسب',4),
      ('No decision','بدون تصمیم',5),
      ('Requirements not met','عدم تطابق با نیاز',6)
    ) AS v(a,b,c)
    WHERE NOT EXISTS (SELECT 1 FROM crm_loss_reasons);

    -- One-time, idempotent: a WON lead that carried a value was, in the old
    -- model, the only place that deal existed. Give it an opportunity so the
    -- pipeline history is not lost. Open leads are deliberately untouched —
    -- they are still leads, not yet deals.
    INSERT INTO crm_opportunities (customer_id, lead_id, title, amount, probability, stage, owner_id, created_at)
    SELECT l.converted_customer_id, l.id, l.name, l.value, 100, 'won', l.owner_id, l.created_at
    FROM crm_leads l
    WHERE l.status='won' AND COALESCE(l.value,0) > 0
      AND NOT EXISTS (SELECT 1 FROM crm_opportunities o WHERE o.lead_id = l.id);
  `)
}
