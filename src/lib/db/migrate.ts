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

    -- The name line ("Husein Habibazar") and the "HBZ" wordmark itself were
    -- hardcoded per-locale literals in Hero.tsx — not editable from the
    -- panel like the rest of hero_content. Making them real columns closes
    -- that gap (maintainer request: every hero string, including "HBZ",
    -- must be DB-backed and admin-editable).
    ALTER TABLE hero_content ADD COLUMN IF NOT EXISTS name TEXT;
    ALTER TABLE hero_content ADD COLUMN IF NOT EXISTS wordmark TEXT;

    -- Media Upload fix — bilingual asset metadata + a real duplicate-name
    -- story for the media library (name → slug → physical filename).
    ALTER TABLE media_files ADD COLUMN IF NOT EXISTS name_en TEXT;
    ALTER TABLE media_files ADD COLUMN IF NOT EXISTS name_fa TEXT;
    ALTER TABLE media_files ADD COLUMN IF NOT EXISTS alt_en TEXT;
    ALTER TABLE media_files ADD COLUMN IF NOT EXISTS alt_fa TEXT;
    ALTER TABLE media_files ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE media_files ADD COLUMN IF NOT EXISTS description TEXT;







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
    -- DOC-BRAND follow-up: an invoice's payment due date (or a quotation's
    -- validity deadline, …) was never a first-class field anywhere in the
    -- Document Engine — only the header's issue date printed. Optional;
    -- absent for every existing row (never populated retroactively).
    ALTER TABLE gen_documents ADD COLUMN IF NOT EXISTS due_date TEXT;

    -- Presentation config per template (applied at render time by
    -- renderDocumentHtml). ONE unified HBZ letterhead design as of 2026-08
    -- (maintainer's explicit request — "one background/layout for every
    -- invoice, only the name/type changes") replaced the prior 40-variant
    -- Invoice Designer library below.
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

    -- Deactivate every template from the old 40-variant library BY EXACT
    -- KEY (never a hard DELETE: a document already generated with one of
    -- these keys must still re-render — renderDocument() falls back to an
    -- empty DocTemplateConfig when the key is missing/inactive, never a
    -- 500). Runs on every boot like the rest of this file, so it must
    -- name the OLD keys explicitly — a blanket "deactivate everything not
    -- in my keep-list" would also silently deactivate any NEW custom
    -- template an admin creates through the Designer UI on next restart.
    UPDATE doc_templates SET active = false WHERE active = true AND key IN (
      'official-invoice','unofficial-invoice','tax-invoice','service-invoice',
      'pro-classic','pro-modern','pro-detailed','pro-service',
      'corp-executive','corp-blue','corp-contract','corp-proforma',
      'min-clean','min-mono','min-compact',
      'retail-pos','retail-store','retail-online',
      'intl-export','intl-usd','intl-eur',
      'ir-official','ir-tax','ir-unofficial',
      'fa-official','fa-tax','fa-unofficial','fa-proforma','fa-service','fa-retail',
      'fa-corporate','fa-blue','fa-green','fa-minimal','fa-classic','fa-modern','fa-gold',
      'fa-contract','fa-letterhead','fa-vat','fa-export','fa-compact','fa-elegant',
      'fa-industrial','fa-clinic'
    );

    -- The single unified HBZ letterhead design — Persian (RTL) and English
    -- (LTR) variants of the SAME background/layout (diagonal navy header,
    -- bilingual card layout, item table, payment/signature/QR footer bar).
    -- "variant" is the only per-document text that changes the printed
    -- subtitle (e.g. "خدمات زیرساخت" / "Network Services") — never a
    -- separate stored template.
    INSERT INTO doc_templates (key, name_en, name_fa, doc_type, config) VALUES
      ('hbz-letterhead-fa', 'HBZ Letterhead (Persian)', 'سربرگ HBZ (فارسی)', NULL,
        '{"variant": "خدمات زیرساخت", "accentColor": "#0f2a52", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "rtl": true}'),
      ('hbz-letterhead-en', 'HBZ Letterhead (English)', 'سربرگ HBZ (انگلیسی)', NULL,
        '{"variant": "Infrastructure Services", "accentColor": "#0f2a52", "showLogo": true, "showSeal": true, "showSignature": true, "showQr": true, "rtl": false}')
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

    -- Item 6 (bug-fix pack): granular job-title role templates. 'Finance
    -- Specialist' (کارشناس مالی) and 'Auditor' (حسابرس) already existed above
    -- and are reused, not duplicated (the already-exists exception). These
    -- are the remaining named positions, each restricting the ERP/HR
    -- submodules it should not touch with an explicit 'none' (deny dominates
    -- the whole subtree per the tree engine) rather than denying the whole
    -- workspace, which would also kill the submodules it SHOULD have.
    INSERT INTO rbac_role_templates (name, name_fa, grants, ops, row_scopes, is_system) VALUES
      ('Senior Admin', 'ادمین ارشد',
       '{"executive":"write","erp":"write","crm":"write","hr":"write","ai":"write","brand":"write","content":"write","operations":"write","analytics":"read","system":"read","security":"read","backup":"read"}',
       '{"erp.finance:post":true,"erp.finance:void":true,"erp.sales:confirm":true,"erp.sales:void":true,"erp.sales:post":true,"erp.sales:return":true,"erp.sales:payment_create":true,"erp.sales:refund":true,"erp.sales:deliver":true,"erp.purchasing:confirm":true,"erp.purchasing:void":true,"erp.purchasing:post":true,"erp.treasury:reconcile":true,"erp.treasury:cheque_state":true,"erp.approvals:approve":true,"erp.approvals:reject":true,"erp.approvals:delegate":true,"erp.moadian:submit":true,"hr.leave:approve":true,"hr.leave:adjust":true,"hr.recruitment:offer":true,"hr.recruitment:hire":true,"hr.reviews:finalize":true}',
       '{}', true),
      ('Admin', 'ادمین',
       '{"executive":"read","brand":"write","content":"write","crm":"write","erp":"write","hr":"read","ai":"write","operations":"read","analytics":"read","system":"none","security":"none","backup":"none"}',
       '{"erp.finance:post":false,"erp.finance:void":false,"erp.finance:close_period":false,"erp.finance:reopen_period":false,"erp.sales:confirm":false,"erp.sales:void":false,"erp.purchasing:confirm":false,"erp.purchasing:void":false,"erp.purchasing:post":false}',
       '{}', true),
      ('HR Specialist', 'کارشناس منابع انسانی',
       '{"hr":"write","executive":"read","erp":"none","crm":"none","system":"none","security":"none","backup":"none","ai":"none"}',
       '{"hr.employees:sensitive_view":true,"hr.employees:delete":false,"hr.payroll:amounts_view":true,"hr.payroll:calculate":true,"hr.payroll:approve":false,"hr.payroll:pay":false,"hr.payroll:settings_write":false,"hr.leave:approve":true,"hr.leave:adjust":false,"hr.recruitment:offer":false,"hr.recruitment:hire":false,"hr.reviews:finalize":false}',
       '{"hr.employees":"department","hr.payroll":"department"}', true),
      ('Finance & HR Manager', 'مدیر مالی و منابع انسانی',
       '{"erp.finance":"write","erp.sales":"write","erp.purchasing":"write","erp.treasury":"write","erp.inventory":"read","hr":"write","executive":"read","analytics":"read","crm":"read","system":"none","security":"none","backup":"none"}',
       '{"erp.finance:post":true,"erp.finance:void":true,"erp.finance:close_period":true,"erp.finance:reopen_period":true,"erp.sales:confirm":true,"erp.sales:void":true,"erp.sales:post":true,"erp.sales:payment_create":true,"erp.sales:refund":true,"erp.purchasing:confirm":true,"erp.purchasing:void":true,"erp.purchasing:post":true,"erp.treasury:reconcile":true,"erp.treasury:cheque_state":true,"erp.approvals:approve":true,"erp.approvals:reject":true,"hr.employees:sensitive_view":true,"hr.payroll:amounts_view":true,"hr.payroll:calculate":true,"hr.payroll:approve":true,"hr.payroll:pay":true,"hr.leave:approve":true,"hr.leave:adjust":true,"hr.recruitment:offer":true,"hr.recruitment:hire":true,"hr.reviews:finalize":true}',
       '{}', true),
      ('Warehouse Keeper', 'انباردار',
       '{"erp.inventory":"write","erp.purchasing":"read","erp.sales":"read","erp.finance":"none","erp.treasury":"none","erp.approvals":"none","hr":"none","crm":"none","system":"none","security":"none","backup":"none","ai":"none","executive":"none"}',
       '{"erp.inventory:cost_view":false}',
       '{}', true),
      ('Procurement', 'تدارکات',
       '{"erp.purchasing":"write","erp.inventory":"read","erp.finance":"none","erp.treasury":"none","hr":"none","crm":"none","system":"none","security":"none","backup":"none","ai":"none","executive":"read"}',
       '{"erp.purchasing:confirm":false,"erp.purchasing:void":false,"erp.purchasing:post":false}',
       '{}', true),
      ('Customer Service Specialist', 'کارشناس امور مشتریان',
       '{"crm.crm":"write","crm.crm.customers":"write","operations.crm.tickets":"write","erp.sales":"read","erp.finance":"none","erp.treasury":"none","erp.purchasing":"none","hr":"none","system":"none","security":"none","backup":"none","ai":"none","executive":"none"}',
       '{}',
       '{"crm.crm":"own","operations.crm.tickets":"own","erp.sales":"own"}', true)
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

    -- ═══════════════════════════════════════════════════════════════════════
    -- Phase 28.3-الف — payroll core.
    --
    -- The whole design exists to keep statutory numbers OUT of the code. Tax
    -- brackets, insurance rates, allowances and — crucially — which earning is
    -- insurable or taxable are all DATA, versioned by ruleset. Next year the
    -- operator copies a ruleset, edits the values, and payroll is correct with
    -- no developer involved.
    -- ═══════════════════════════════════════════════════════════════════════

    -- A ruleset is versioned WITHIN a year, not just by year: Iranian law can
    -- change mid-year (a minimum-wage circular in Tir), and a slip must always
    -- name the exact version it was computed with. Changing the rules never
    -- reaches back into slips already issued.
    CREATE TABLE IF NOT EXISTS payroll_rulesets (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      title TEXT,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      source TEXT,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft','approved','archived')),
      created_by TEXT REFERENCES users(id),
      approved_by TEXT REFERENCES users(id),
      approved_at TEXT,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_ruleset_ver
      ON payroll_rulesets(year, version, COALESCE(company_id, 0));

    -- Brackets are ROWS, not fixed columns. A year with seven bands instead of
    -- six is a data change, not a migration.
    CREATE TABLE IF NOT EXISTS payroll_tax_brackets (
      id SERIAL PRIMARY KEY,
      ruleset_id INTEGER NOT NULL REFERENCES payroll_rulesets(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL DEFAULT 0,
      from_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      to_amount NUMERIC(18,2),
      rate_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
      company_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_brackets ON payroll_tax_brackets(ruleset_id, seq);

    -- Typed key/value so a NEW parameter never needs a migration.
    CREATE TABLE IF NOT EXISTS payroll_parameters (
      id SERIAL PRIMARY KEY,
      ruleset_id INTEGER NOT NULL REFERENCES payroll_rulesets(id) ON DELETE CASCADE,
      param_group TEXT NOT NULL CHECK(param_group IN ('tax','insurance','labor','company')),
      key TEXT NOT NULL,
      label_fa TEXT NOT NULL,
      label_en TEXT NOT NULL,
      value_type TEXT NOT NULL CHECK(value_type IN ('amount','percent','factor','boolean','integer')),
      value NUMERIC(18,4) NOT NULL DEFAULT 0,
      unit TEXT,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      company_id INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_param_key ON payroll_parameters(ruleset_id, key);

    -- Append-only: who changed which parameter, when, from what to what.
    CREATE TABLE IF NOT EXISTS payroll_policy_history (
      id SERIAL PRIMARY KEY,
      ruleset_id INTEGER NOT NULL REFERENCES payroll_rulesets(id) ON DELETE CASCADE,
      entity TEXT NOT NULL,
      entity_key TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT REFERENCES users(id),
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_policy_hist ON payroll_policy_history(ruleset_id, created_at);

    -- 🔴 The correctness of every slip rests on THIS table. Whether the food
    -- allowance is insurable, or how much of the housing allowance is exempt,
    -- is regulation — it changes, so it is data the operator edits, never a
    -- condition compiled into the engine.
    CREATE TABLE IF NOT EXISTS payroll_earning_types (
      id SERIAL PRIMARY KEY,
      ruleset_id INTEGER NOT NULL REFERENCES payroll_rulesets(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      label_fa TEXT NOT NULL,
      label_en TEXT NOT NULL,
      earning_group TEXT NOT NULL DEFAULT 'allowance',
      -- recurring (مستمر) vs non-recurring — decides the Eid-bonus and
      -- severance bases, which 28.3-ب will read.
      recurring INTEGER NOT NULL DEFAULT 1,
      insurable TEXT NOT NULL DEFAULT 'yes' CHECK(insurable IN ('yes','no','capped')),
      insurable_cap NUMERIC(18,2),
      taxable TEXT NOT NULL DEFAULT 'yes' CHECK(taxable IN ('yes','no','capped')),
      taxable_cap NUMERIC(18,2),
      in_eid_base INTEGER NOT NULL DEFAULT 0,
      in_severance_base INTEGER NOT NULL DEFAULT 0,
      in_overtime_base INTEGER NOT NULL DEFAULT 0,
      calc_method TEXT NOT NULL DEFAULT 'fixed'
        CHECK(calc_method IN ('fixed','percent_of_base','daily_prorated','per_child','manual')),
      calc_value NUMERIC(18,4) NOT NULL DEFAULT 0,
      param_key TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      company_id INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_earning_key ON payroll_earning_types(ruleset_id, key);

    -- ── periods, slips, loans ───────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS payroll_periods (
      id SERIAL PRIMARY KEY,
      ruleset_id INTEGER NOT NULL REFERENCES payroll_rulesets(id),
      jalali_year INTEGER NOT NULL,
      jalali_month INTEGER NOT NULL CHECK(jalali_month BETWEEN 1 AND 12),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days_in_month INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'open'
        CHECK(status IN ('open','calculated','approved','paid','locked')),
      calculated_by TEXT REFERENCES users(id),
      calculated_at TEXT,
      approved_by TEXT REFERENCES users(id),
      approved_at TEXT,
      paid_at TEXT,
      gl_entry_id INTEGER,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_period_month
      ON payroll_periods(jalali_year, jalali_month, COALESCE(company_id, 0));

    CREATE TABLE IF NOT EXISTS payroll_slips (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id),
      ruleset_id INTEGER NOT NULL REFERENCES payroll_rulesets(id),
      worked_days NUMERIC(6,2) NOT NULL DEFAULT 0,
      gross NUMERIC(18,2) NOT NULL DEFAULT 0,
      insurance_base NUMERIC(18,2) NOT NULL DEFAULT 0,
      employee_insurance NUMERIC(18,2) NOT NULL DEFAULT 0,
      employer_insurance NUMERIC(18,2) NOT NULL DEFAULT 0,
      unemployment_insurance NUMERIC(18,2) NOT NULL DEFAULT 0,
      taxable_income NUMERIC(18,2) NOT NULL DEFAULT 0,
      tax NUMERIC(18,2) NOT NULL DEFAULT 0,
      deductions NUMERIC(18,2) NOT NULL DEFAULT 0,
      net NUMERIC(18,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft','approved','paid','reversed','correction')),
      reversal_of INTEGER,
      reversed_by INTEGER,
      note TEXT,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_slips ON payroll_slips(period_id, employee_id);

    CREATE TABLE IF NOT EXISTS payroll_slip_lines (
      id SERIAL PRIMARY KEY,
      slip_id INTEGER NOT NULL REFERENCES payroll_slips(id) ON DELETE CASCADE,
      line_type TEXT NOT NULL CHECK(line_type IN ('earning','deduction','employer_cost')),
      key TEXT NOT NULL,
      label_fa TEXT NOT NULL,
      label_en TEXT NOT NULL,
      amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      insurable INTEGER NOT NULL DEFAULT 0,
      taxable INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      company_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_slip_lines ON payroll_slip_lines(slip_id);

    CREATE TABLE IF NOT EXISTS payroll_loans (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      installments INTEGER NOT NULL DEFAULT 1,
      monthly_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      start_date TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','settled','cancelled')),
      note TEXT,
      created_by TEXT REFERENCES users(id),
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_loans ON payroll_loans(employee_id, status);

    -- A LEDGER, like the leave balance: the outstanding amount is the total
    -- minus the sum of these rows, never a column somebody writes.
    CREATE TABLE IF NOT EXISTS payroll_loan_installments (
      id SERIAL PRIMARY KEY,
      loan_id INTEGER NOT NULL REFERENCES payroll_loans(id) ON DELETE CASCADE,
      slip_id INTEGER,
      period_id INTEGER,
      amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'payment' CHECK(kind IN ('payment','reversal','adjust')),
      note TEXT,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_loan_inst ON payroll_loan_installments(loan_id);

    -- ═══════════════════════════════════════════════════════════════════════
    -- Phase 28.3-ج — bank payment, advances, and the monthly cycle's last link.
    -- ═══════════════════════════════════════════════════════════════════════

    -- 🔴 The file format is DATA. Each bank has its own column order and it
    -- changes without notice; a hardcoded formatter means every bank change is
    -- a release. A generic CSV ships as the default, seeded non-destructively.
    CREATE TABLE IF NOT EXISTS payroll_bank_formats (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'csv' CHECK(file_type IN ('csv','txt','xlsx')),
      delimiter TEXT NOT NULL DEFAULT ',',
      encoding TEXT NOT NULL DEFAULT 'utf-8',
      include_header INTEGER NOT NULL DEFAULT 1,
      columns TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_bank_fmt_key
      ON payroll_bank_formats(key, COALESCE(company_id, 0));

    CREATE TABLE IF NOT EXISTS payroll_bank_batches (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES payroll_periods(id),
      format_id INTEGER REFERENCES payroll_bank_formats(id),
      source_account TEXT,
      payment_date TEXT,
      record_count INTEGER NOT NULL DEFAULT 0,
      total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft','generated','sent','confirmed')),
      gl_entry_id INTEGER,
      created_by TEXT REFERENCES users(id),
      approved_by TEXT REFERENCES users(id),
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    -- 🔴 idempotency: one batch per period, ever — a retried "generate" click
    -- must not create a second payment run for the same money.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_bank_batch_period ON payroll_bank_batches(period_id);

    CREATE TABLE IF NOT EXISTS payroll_bank_batch_lines (
      id SERIAL PRIMARY KEY,
      batch_id INTEGER NOT NULL REFERENCES payroll_bank_batches(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id),
      iban TEXT,
      amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','sent','confirmed','rejected')),
      reject_reason TEXT,
      company_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_bank_lines ON payroll_bank_batch_lines(batch_id);

    -- Advances are NOT loans: a one-off deduction in a named month, no
    -- instalment schedule.
    CREATE TABLE IF NOT EXISTS payroll_advances (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      requested_at TEXT,
      paid_at TEXT,
      deduct_jalali_year INTEGER NOT NULL,
      deduct_jalali_month INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested'
        CHECK(status IN ('requested','approved','paid','deducted','cancelled')),
      approval_request_id INTEGER,
      gl_entry_id INTEGER,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      approved_by TEXT REFERENCES users(id),
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_advances ON payroll_advances(employee_id, status);

    INSERT INTO gl_accounts (code, name_en, name_fa, type) VALUES
      ('1170','Employee Advances Receivable','مساعدهٔ دریافتنی از کارکنان','asset')
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO erp_settings (key, value)
    SELECT * FROM (VALUES ('gl_map_payroll_advance','1170')) AS v(k,val)
    WHERE NOT EXISTS (SELECT 1 FROM erp_settings s WHERE s.key = v.k);

    -- Seed: a generic CSV format the operator can copy and adapt, marked
    -- unverified because no real bank template was supplied.
    INSERT INTO payroll_bank_formats (key, bank_name, file_type, delimiter, encoding, columns, verified, note)
    SELECT 'generic_csv', 'فرمت عمومی CSV (نمونه — قالب بانک واقعی را جایگزین کنید)', 'csv', ',', 'utf-8',
      '[{"key": "row", "labelFa": "ردیف"}, {"key": "iban", "labelFa": "شبا"}, {"key": "amount", "labelFa": "مبلغ"}, {"key": "employeeName", "labelFa": "نام"}, {"key": "description", "labelFa": "شرح"}]', 0, 'با بانک سازمان تطبیق داده نشده — نمونهٔ اولیه است، جایگزین کنید'
    WHERE NOT EXISTS (SELECT 1 FROM payroll_bank_formats WHERE key='generic_csv');

    -- ── GL account map + accounts (28.3-الف بند ۶) ──────────────────────────

    -- ── GL account map + accounts (28.3-الف بند ۶) ──────────────────────────
    INSERT INTO gl_accounts (code, name_en, name_fa, type) VALUES
      ('2300','Salaries Payable','حقوق پرداختنی','liability'),
      ('2310','Social Insurance Payable','بیمه پرداختنی','liability'),
      ('2320','Payroll Tax Payable','مالیات حقوق پرداختنی','liability'),
      ('1160','Employee Loans Receivable','وام کارکنان','asset'),
      ('6110','Employer Insurance Expense','هزینهٔ بیمهٔ سهم کارفرما','expense')
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO erp_settings (key, value)
    SELECT * FROM (VALUES
      ('gl_map_payroll_expense','6100'),
      ('gl_map_payroll_employer_insurance_expense','6110'),
      ('gl_map_payroll_payable','2300'),
      ('gl_map_payroll_insurance_payable','2310'),
      ('gl_map_payroll_tax_payable','2320'),
      ('gl_map_payroll_loan','1160')
    ) AS v(k,val)
    WHERE NOT EXISTS (SELECT 1 FROM erp_settings s WHERE s.key = v.k);

    -- ── seed: ruleset 1405 v1 ───────────────────────────────────────────────
    -- Idempotent AND non-destructive: it only ever inserts the ruleset if that
    -- (year, version) is absent, so an operator's edits are never overwritten.
    -- ═══════════════════════════════════════════════════════════════════════
    -- Phase 28.3-ب — annual entitlements and final settlement.
    --
    -- 🔴 The distinction the whole sub-phase turns on: "پایهٔ سنوات" (a monthly
    -- recurring allowance added to pay, already handled in 28.3-الف as an
    -- earning type) and "سنوات پایان خدمت" (one month's pay per year of
    -- service, paid when someone leaves) are TWO DIFFERENT THINGS. Conflating
    -- them is the one error here that stays invisible for years and only
    -- surfaces at the final settlement, when it is expensive and disputed.
    -- These tables are only about the SECOND one.
    -- ═══════════════════════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS payroll_eid_calculations (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      ruleset_id INTEGER NOT NULL REFERENCES payroll_rulesets(id),
      jalali_year INTEGER NOT NULL,
      service_days INTEGER NOT NULL DEFAULT 0,
      days_in_year INTEGER NOT NULL DEFAULT 365,
      monthly_base NUMERIC(18,2) NOT NULL DEFAULT 0,
      gross NUMERIC(18,2) NOT NULL DEFAULT 0,
      floor_applied NUMERIC(18,2),
      ceiling_applied NUMERIC(18,2),
      amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      tax NUMERIC(18,2) NOT NULL DEFAULT 0,
      net NUMERIC(18,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft','approved','paid','reversed','correction')),
      gl_entry_id INTEGER,
      reversal_of INTEGER,
      reversed_by INTEGER,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_eid ON payroll_eid_calculations(employee_id, jalali_year);

    CREATE TABLE IF NOT EXISTS payroll_severance_calculations (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      ruleset_id INTEGER NOT NULL REFERENCES payroll_rulesets(id),
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL,
      service_days INTEGER NOT NULL DEFAULT 0,
      daily_base NUMERIC(18,2) NOT NULL DEFAULT 0,
      base_policy TEXT NOT NULL DEFAULT 'last',
      days_per_year NUMERIC(8,2) NOT NULL DEFAULT 30,
      amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      accrued_before NUMERIC(18,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft','approved','paid','reversed','correction')),
      gl_entry_id INTEGER,
      reversal_of INTEGER,
      reversed_by INTEGER,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_severance ON payroll_severance_calculations(employee_id);

    -- Monthly severance provision. OFF by default: recognising the liability as
    -- it accrues is the accounting-correct treatment, but whether to do it is a
    -- company policy an accountant must decide, so the system does not assume.
    CREATE TABLE IF NOT EXISTS payroll_severance_accruals (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      period_id INTEGER REFERENCES payroll_periods(id) ON DELETE CASCADE,
      amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'accrual' CHECK(kind IN ('accrual','settlement','reversal')),
      gl_entry_id INTEGER,
      note TEXT,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_sev_accrual ON payroll_severance_accruals(employee_id, period_id);

    CREATE TABLE IF NOT EXISTS payroll_settlements (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      end_date TEXT NOT NULL,
      reason TEXT,
      last_slip_id INTEGER,
      severance_id INTEGER,
      eid_id INTEGER,
      final_pay NUMERIC(18,2) NOT NULL DEFAULT 0,
      severance NUMERIC(18,2) NOT NULL DEFAULT 0,
      eid NUMERIC(18,2) NOT NULL DEFAULT 0,
      leave_encashment NUMERIC(18,2) NOT NULL DEFAULT 0,
      leave_days NUMERIC(8,2) NOT NULL DEFAULT 0,
      loan_outstanding NUMERIC(18,2) NOT NULL DEFAULT 0,
      other_deductions NUMERIC(18,2) NOT NULL DEFAULT 0,
      total NUMERIC(18,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft','approved','paid','reversed')),
      gl_entry_id INTEGER,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      approved_by TEXT REFERENCES users(id),
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_settlements ON payroll_settlements(employee_id);

    -- Configurable legal-export layouts. The exact column order of the social
    -- security (DSK) and tax files can change; a layout that lives in the
    -- database can be corrected without a release.
    CREATE TABLE IF NOT EXISTS payroll_export_layouts (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL,
      title_fa TEXT NOT NULL,
      title_en TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('insurance','tax','summary')),
      delimiter TEXT NOT NULL DEFAULT ',',
      include_header INTEGER NOT NULL DEFAULT 1,
      encoding TEXT NOT NULL DEFAULT 'utf-8',
      columns TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_export_key
      ON payroll_export_layouts(key, COALESCE(company_id, 0));

    INSERT INTO gl_accounts (code, name_en, name_fa, type) VALUES
      ('2330','Eid Bonus Payable','عیدی پرداختنی','liability'),
      ('2340','Severance Provision','ذخیرهٔ سنوات','liability'),
      ('6120','Eid Bonus Expense','هزینهٔ عیدی','expense'),
      ('6130','Severance Expense','هزینهٔ سنوات','expense')
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO erp_settings (key, value)
    SELECT * FROM (VALUES
      ('gl_map_payroll_eid_expense','6120'),
      ('gl_map_payroll_eid_payable','2330'),
      ('gl_map_payroll_severance_expense','6130'),
      ('gl_map_payroll_severance_payable','2340')
    ) AS v(k,val)
    WHERE NOT EXISTS (SELECT 1 FROM erp_settings s WHERE s.key = v.k);

    INSERT INTO payroll_rulesets (year, version, title, effective_from, effective_to, source, status)
      SELECT 1405, 1, 'مجموعه‌قوانین حقوق و دستمزد ۱۴۰۵', '2026-03-21', '2027-03-20',
             'بخشنامهٔ مزد ۱۴۰۵ — مقدار اولیه، لطفاً با بخشنامهٔ رسمی تطبیق دهید', 'draft'
      WHERE NOT EXISTS (SELECT 1 FROM payroll_rulesets WHERE year=1405 AND version=1);
  `)

  const rs1405 = (await pgQuery<{ id: number }>(
    `SELECT id FROM payroll_rulesets WHERE year=1405 AND version=1 LIMIT 1`))[0]?.id
  if (rs1405) {
    // Seeded only when the ruleset has no rows yet — re-running migrations must
    // never revert a value the operator changed.
    const hasParams = (await pgQuery<{ n: string }>(
      `SELECT count(*)::text AS n FROM payroll_parameters WHERE ruleset_id=$1`, [rs1405]))[0]?.n !== '0'
    if (!hasParams) {
      const params: [string, string, string, string, string, number, string | null, string | null, number][] = [
        ['tax', 'monthly_exemption', 'معافیت ماهانهٔ مالیات', 'Monthly tax exemption', 'amount', 400_000_000, 'ریال', 'درآمد تا این مبلغ در هر ماه معاف است', 1],
        ['insurance', 'employee_rate', 'سهم بیمهٔ کارمند', 'Employee insurance rate', 'percent', 7, '٪', null, 1],
        ['insurance', 'employer_rate', 'سهم بیمهٔ کارفرما', 'Employer insurance rate', 'percent', 20, '٪', 'هزینهٔ شرکت است، از کارمند کسر نمی‌شود', 2],
        ['insurance', 'unemployment_rate', 'بیمهٔ بیکاری (سهم کارفرما)', 'Unemployment insurance rate', 'percent', 3, '٪', null, 3],
        ['insurance', 'max_base_factor', 'ضریب سقف مبنای بیمه', 'Insurance ceiling factor', 'factor', 7, 'برابر حداقل مزد روزانه', 'به‌صورت ضریب نگه داشته می‌شود تا با تغییر حداقل مزد خودکار به‌روز شود', 4],
        ['labor', 'min_wage_daily', 'حداقل مزد روزانه', 'Minimum daily wage', 'amount', 5_541_850, 'ریال', null, 1],
        ['labor', 'min_wage_monthly_30', 'حداقل مزد ماهانه (۳۰ روز)', 'Minimum monthly wage', 'amount', 166_255_550, 'ریال', null, 2],
        ['labor', 'housing_allowance', 'حق مسکن', 'Housing allowance', 'amount', 30_000_000, 'ریال', null, 3],
        ['labor', 'food_allowance', 'بن کارگری', 'Food allowance', 'amount', 22_000_000, 'ریال', null, 4],
        ['labor', 'marriage_allowance', 'حق تأهل', 'Marriage allowance', 'amount', 5_000_000, 'ریال', null, 5],
        ['labor', 'child_allowance_each', 'حق اولاد (هر فرزند)', 'Child allowance (each)', 'amount', 16_625_560, 'ریال', null, 6],
        ['company', 'daily_work_hours', 'ساعت کاری روزانه', 'Daily working hours', 'integer', 7.33, 'ساعت', 'مبنای تبدیل مزد روزانه به مزد ساعتی', 1],
        ['company', 'overtime_factor', 'ضریب اضافه‌کار', 'Overtime factor', 'factor', 1.4, 'برابر', 'حداقل قانونی ۱.۴ — شرکت می‌تواند بالاتر بگذارد', 2],
        ['company', 'holiday_overtime_factor', 'ضریب تعطیل‌کاری', 'Holiday work factor', 'factor', 1.96, 'برابر', null, 3],
        ['company', 'friday_factor', 'ضریب جمعه‌کاری', 'Friday work factor', 'factor', 1.4, 'برابر', null, 4],
        ['company', 'night_shift_factor', 'ضریب شب‌کاری', 'Night shift factor', 'factor', 1.75, 'برابر', null, 5],
        ['company', 'shift_factor', 'ضریب نوبت‌کاری', 'Rotating shift factor', 'factor', 1.15, 'برابر', null, 6],
        ['company', 'rounding', 'گرد کردن خالص پرداختی', 'Net rounding', 'amount', 1000, 'ریال', 'صفر یعنی بدون گرد کردن', 7],
        ['company', 'absence_deduction_enabled', 'کسر غیبت', 'Deduct absence', 'boolean', 1, null, null, 8],
        ['company', 'late_deduction_enabled', 'کسر تأخیر', 'Deduct lateness', 'boolean', 0, null, 'پیش‌فرض خاموش — سیاست شرکت است نه الزام قانونی', 9],
        // ── 28.3-ب: annual entitlements. Statutory shape, editable values.
        ['labor', 'eid_days', 'روزهای مبنای عیدی', 'Eid bonus days', 'integer', 60, 'روز', 'عیدی معادل چند روز آخرین مزد', 10],
        ['labor', 'eid_min_days_of_min_wage', 'حداقل عیدی (روزِ حداقل مزد)', 'Eid floor in minimum-wage days', 'integer', 60, 'روز', null, 11],
        ['labor', 'eid_max_days_of_min_wage', 'حداکثر عیدی (روزِ حداقل مزد)', 'Eid ceiling in minimum-wage days', 'integer', 90, 'روز', null, 12],
        ['tax', 'eid_tax_exempt_amount', 'معافیت مالیاتی عیدی', 'Eid tax exemption', 'amount', 0, 'ریال', 'صفر یعنی عیدی کاملاً مشمول است — طبق بخشنامهٔ سال تنظیم شود', 2],
        ['labor', 'severance_days_per_year', 'روزهای سنوات به ازای هر سال', 'Severance days per year of service', 'integer', 30, 'روز', 'یک ماه مزد به ازای هر سال — حداقل قانونی', 13],
        ['company', 'severance_base_policy', 'مبنای سنوات', 'Severance base policy', 'integer', 0, null, 'صفر = آخرین مزد · یک = میانگین سه ماه آخر', 10],
        ['company', 'severance_accrual_enabled', 'ذخیرهٔ ماهانهٔ سنوات', 'Monthly severance provision', 'boolean', 0, null, '🔴 پیش‌فرض خاموش — شناسایی ماهانهٔ بدهی سنوات را با حسابدار خود تصمیم بگیرید', 11],
        ['company', 'leave_encashment_enabled', 'بازخرید مرخصی استفاده‌نشده', 'Encash unused leave', 'boolean', 1, null, null, 12],
        ['company', 'leave_encashment_max_days', 'سقف روز قابل بازخرید', 'Maximum encashable leave days', 'integer', 9, 'روز', 'صفر یعنی بدون سقف', 13],
        // ── 28.3-ج: advances + conditional-inclusion caps ──
        ['company', 'advance_max_percent_of_salary', 'سقف مساعده (٪ حقوق ماهانه)', 'Advance cap (% of monthly salary)', 'percent', 50, '٪', 'سیاست شرکت — قابل تنظیم', 14],
        ['tax', 'housing_taxable_cap', 'سقف معافیت مالیاتی حق مسکن', 'Housing allowance tax-exempt cap', 'amount', 30_000_000, 'ریال', 'طبق بخشنامهٔ سال — مقدار اولیه برابر با کل مبلغ یعنی کاملاً معاف', 3],
        ['tax', 'food_taxable_cap', 'سقف معافیت مالیاتی بن کارگری', 'Food allowance tax-exempt cap', 'amount', 22_000_000, 'ریال', 'طبق بخشنامهٔ سال', 4],
        ['tax', 'mission_taxable_cap', 'سقف معافیت مالیاتی هزینهٔ مأموریت', 'Mission expense tax-exempt cap', 'amount', 0, 'ریال', 'صفر یعنی نامحدود تا مبلغ واقعی — با بخشنامهٔ سال تنظیم شود', 5],
        ['insurance', 'sick_leave_employer_threshold_days', 'سقف روز استعلاجی بر عهدهٔ کارفرما', 'Sick-leave days at employer cost', 'integer', 3, 'روز', '🔴 با حسابدار تطبیق دهید — روزهای اول استعلاجی معمولاً بر عهدهٔ کارفرماست، بقیه بر عهدهٔ تأمین اجتماعی', 5],
        ['insurance', 'sick_leave_insurance_rate_percent', 'نرخ غرامت استعلاجی تأمین اجتماعی', 'Social-security sick-pay rate', 'percent', 100, '٪', 'درصدی از مزد روزانه که تأمین اجتماعی برای روزهای پس از سقف می‌پردازد', 6],
      ]
      for (const [g, k, fa, en, t, v, unit, desc, sort] of params) {
        await pgQuery(
          `INSERT INTO payroll_parameters (ruleset_id, param_group, key, label_fa, label_en, value_type, value, unit, description, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
          [rs1405, g, k, fa, en, t, v, unit, desc, sort])
      }
    }

    const hasBrackets = (await pgQuery<{ n: string }>(
      `SELECT count(*)::text AS n FROM payroll_tax_brackets WHERE ruleset_id=$1`, [rs1405]))[0]?.n !== '0'
    if (!hasBrackets) {
      const brackets: [number, number, number | null, number][] = [
        [0, 0, 400_000_000, 0],
        [1, 400_000_000, 800_000_000, 10],
        [2, 800_000_000, 1_000_000_000, 15],
        [3, 1_000_000_000, 1_200_000_000, 20],
        [4, 1_200_000_000, 1_400_000_000, 25],
        [5, 1_400_000_000, null, 30],
      ]
      for (const [seq, from, to, rate] of brackets) {
        await pgQuery(
          `INSERT INTO payroll_tax_brackets (ruleset_id, seq, from_amount, to_amount, rate_percent)
           VALUES ($1,$2,$3,$4,$5)`, [rs1405, seq, from, to, rate])
      }
    }

    const hasEarnings = (await pgQuery<{ n: string }>(
      `SELECT count(*)::text AS n FROM payroll_earning_types WHERE ruleset_id=$1`, [rs1405]))[0]?.n !== '0'
    if (!hasEarnings) {
      // key, fa, en, group, recurring, insurable, taxable, eid, severance, overtimeBase, method, paramKey, sort
      const earnings: [string, string, string, string, number, string, string, number, number, number, string, string | null, number][] = [
        ['base_salary', 'حقوق پایه', 'Base salary', 'salary', 1, 'yes', 'yes', 1, 1, 1, 'daily_prorated', null, 1],
        ['seniority_base', 'پایهٔ سنوات', 'Seniority base', 'salary', 1, 'yes', 'yes', 1, 1, 1, 'manual', null, 2],
        ['housing', 'حق مسکن', 'Housing allowance', 'allowance', 1, 'yes', 'yes', 1, 0, 0, 'daily_prorated', 'housing_allowance', 3],
        ['food', 'بن کارگری', 'Food allowance', 'allowance', 1, 'yes', 'yes', 1, 0, 0, 'daily_prorated', 'food_allowance', 4],
        ['marriage', 'حق تأهل', 'Marriage allowance', 'allowance', 1, 'no', 'no', 0, 0, 0, 'fixed', 'marriage_allowance', 5],
        ['child', 'حق اولاد', 'Child allowance', 'allowance', 1, 'no', 'no', 0, 0, 0, 'per_child', 'child_allowance_each', 6],
        ['job_allowance', 'فوق‌العادهٔ شغل', 'Job allowance', 'allowance', 1, 'yes', 'yes', 1, 0, 1, 'manual', null, 7],
        ['expertise', 'فوق‌العادهٔ تخصص', 'Expertise allowance', 'allowance', 1, 'yes', 'yes', 1, 0, 1, 'manual', null, 8],
        ['supervision', 'فوق‌العادهٔ سرپرستی', 'Supervision allowance', 'allowance', 1, 'yes', 'yes', 1, 0, 1, 'manual', null, 9],
        ['overtime', 'اضافه‌کار', 'Overtime', 'variable', 0, 'yes', 'yes', 0, 0, 0, 'manual', null, 10],
        ['holiday_work', 'تعطیل‌کاری', 'Holiday work', 'variable', 0, 'yes', 'yes', 0, 0, 0, 'manual', null, 11],
        ['friday_work', 'جمعه‌کاری', 'Friday work', 'variable', 0, 'yes', 'yes', 0, 0, 0, 'manual', null, 12],
        ['night_shift', 'شب‌کاری', 'Night shift', 'variable', 0, 'yes', 'yes', 0, 0, 0, 'manual', null, 13],
        ['shift_work', 'نوبت‌کاری', 'Rotating shift', 'variable', 0, 'yes', 'yes', 0, 0, 0, 'manual', null, 14],
        ['bonus', 'پاداش', 'Bonus', 'variable', 0, 'no', 'yes', 0, 0, 0, 'manual', null, 15],
        ['commission', 'پورسانت', 'Commission', 'variable', 0, 'no', 'yes', 0, 0, 0, 'manual', null, 16],
        ['mission_expense', 'هزینهٔ مأموریت', 'Mission expense', 'variable', 0, 'no', 'no', 0, 0, 0, 'manual', null, 17],
      ]
      for (const [k, fa, en, grp, rec, ins, tax, eid, sev, ot, method, pk, sort] of earnings) {
        await pgQuery(
          `INSERT INTO payroll_earning_types
             (ruleset_id, key, label_fa, label_en, earning_group, recurring, insurable, taxable,
              in_eid_base, in_severance_base, in_overtime_base, calc_method, param_key, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT DO NOTHING`,
          [rs1405, k, fa, en, grp, rec, ins, tax, eid, sev, ot, method, pk, sort])
      }
    }
  }

  // 28.3-ب: export layouts. These are STARTING POINTS whose column order has
  // NOT been verified against a real submission file — `verified` stays 0 until
  // the operator confirms it against the portal, and the UI says so.
  const hasLayouts = (await pgQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM payroll_export_layouts`))[0]?.n !== '0'
  if (!hasLayouts) {
    const layouts: [string, string, string, string, string][] = [
      ['dsk_insurance', 'لیست بیمه (تأمین اجتماعی)', 'Social security list (DSK)', 'insurance',
        JSON.stringify([
          { key: 'row', labelFa: 'ردیف' },
          { key: 'insuranceNo', labelFa: 'شمارهٔ بیمه' },
          { key: 'nationalId', labelFa: 'کد ملی' },
          { key: 'firstName', labelFa: 'نام' },
          { key: 'lastName', labelFa: 'نام خانوادگی' },
          { key: 'fatherName', labelFa: 'نام پدر' },
          { key: 'birthDate', labelFa: 'تاریخ تولد' },
          { key: 'hireDate', labelFa: 'تاریخ شروع' },
          { key: 'workedDays', labelFa: 'روزهای کارکرد' },
          { key: 'insuranceBase', labelFa: 'مبنای بیمه' },
          { key: 'employeeInsurance', labelFa: 'سهم بیمه‌شده' },
          { key: 'employerInsurance', labelFa: 'سهم کارفرما' },
          { key: 'unemploymentInsurance', labelFa: 'بیمهٔ بیکاری' },
        ])],
      ['tax_payroll', 'لیست مالیات حقوق', 'Payroll tax list', 'tax',
        JSON.stringify([
          { key: 'row', labelFa: 'ردیف' },
          { key: 'nationalId', labelFa: 'کد ملی' },
          { key: 'firstName', labelFa: 'نام' },
          { key: 'lastName', labelFa: 'نام خانوادگی' },
          { key: 'employeeCode', labelFa: 'کد پرسنلی' },
          { key: 'gross', labelFa: 'جمع ناخالص' },
          { key: 'exemptTotal', labelFa: 'معافیت‌ها' },
          { key: 'taxableIncome', labelFa: 'درآمد مشمول' },
          { key: 'tax', labelFa: 'مالیات' },
          { key: 'net', labelFa: 'خالص پرداختی' },
        ])],
      ['period_summary', 'خلاصهٔ دوره برای حسابداری', 'Period summary for accounting', 'summary',
        JSON.stringify([
          { key: 'employeeCode', labelFa: 'کد پرسنلی' },
          { key: 'fullName', labelFa: 'نام و نام خانوادگی' },
          { key: 'workedDays', labelFa: 'روز کارکرد' },
          { key: 'gross', labelFa: 'جمع مزایا' },
          { key: 'insuranceBase', labelFa: 'مبنای بیمه' },
          { key: 'employeeInsurance', labelFa: 'بیمهٔ کارمند' },
          { key: 'employerInsurance', labelFa: 'بیمهٔ کارفرما' },
          { key: 'tax', labelFa: 'مالیات' },
          { key: 'deductions', labelFa: 'کسورات' },
          { key: 'net', labelFa: 'خالص' },
        ])],
    ]
    for (const [key, fa, en, kind, columns] of layouts) {
      await pgQuery(
        `INSERT INTO payroll_export_layouts (key, title_fa, title_en, kind, columns, verified, note)
         VALUES ($1,$2,$3,$4,$5,0,$6) ON CONFLICT DO NOTHING`,
        [key, fa, en, kind, columns,
          kind === 'summary' ? null
            : 'ساختار ستون‌ها با فایل واقعی سامانه تطبیق داده نشده است — پیش از ارسال، ترتیب ستون‌ها را بررسی و تأیید کنید'])
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 28.4 — employee portal.
  //
  // 🔴 hr_portal_sessions is COMPLETELY INDEPENDENT of customer_portal_sessions
  // and the admin JWT: its own table, its own cookie name (`hr_portal_token`
  // vs `portal_token` vs `admin_token`), its own opaque sha256-hashed token.
  // Reusing the pattern (OTP hashed/single-use/expiry, opaque token) is
  // correct; reusing the SESSION would let a customer's cookie authenticate
  // as an employee or vice versa — exactly what R9/بند۱ forbids.
  // ═══════════════════════════════════════════════════════════════════════
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS hr_portal_sessions (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      channel TEXT NOT NULL DEFAULT 'otp' CHECK(channel IN ('otp','magic_link')),
      identifier TEXT NOT NULL,
      otp_hash TEXT,
      otp_expires_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      token_hash TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      revoked INTEGER NOT NULL DEFAULT 0,
      ip TEXT,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_portal_sess_token ON hr_portal_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_hr_portal_sess_emp ON hr_portal_sessions(employee_id);

    -- Administrative "asks" that route through the existing approval engine.
    -- 🔴 An info-correction request is NEVER auto-applied — it is a PROPOSAL
    -- HR reviews and applies by hand through the employee editor, because a
    -- national-id or IBAN change is exactly the kind of thing R8 protects.
    CREATE TABLE IF NOT EXISTS hr_portal_requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('certificate','advance','mission','info_correction')),
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','fulfilled')),
      approval_request_id INTEGER,
      note TEXT,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_portal_req_emp ON hr_portal_requests(employee_id, status);

    -- A default rule so an hr_portal_request does not auto-approve just
    -- because no rule was configured (the same 28.2 lesson: absence of a
    -- matrix rule must not read as "granted").
    INSERT INTO approval_matrix (doc_type, name_en, name_fa, min_amount, levels, priority, active)
      SELECT 'hr_portal_request', 'Employee portal request', 'درخواست پورتال کارمند', 0,
             '[{"level":1,"mode":"any","approvers":[{"type":"role","ref":"administrator"},{"type":"role","ref":"super_admin"}]}]', 0, 1
      WHERE NOT EXISTS (SELECT 1 FROM approval_matrix WHERE doc_type='hr_portal_request');
  `)

  // ── Phase 28.5 — recruitment, training, performance review ─────────────────
  //
  // `courses`/`course_categories`/`course_lessons` were audited before adding
  // anything: they are the PUBLIC academy catalog (no employee_id, no
  // company_id, no "mandatory for this employee" concept, instructor is a
  // `users` row, not `hr_employees`). That is a structurally different thing
  // from an internal training assignment, so the catalog is REUSED
  // (hr_training_enrollments.course_id → courses.id) but the enrollment/
  // completion/certificate record is its own table, not a duplicate catalog.
  // Likewise `certifications` is Husein's own public credential showcase
  // (single-owner, site-wide) — not a per-employee table, so it is left alone.
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS hr_job_openings (
      id SERIAL PRIMARY KEY,
      title_fa TEXT NOT NULL,
      title_en TEXT,
      position_id INTEGER REFERENCES hr_positions(id) ON DELETE SET NULL,
      department_id INTEGER,
      description TEXT,
      requirements TEXT,
      headcount INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','cancelled')),
      opens_at TEXT,
      closes_at TEXT,
      company_id INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_openings_status ON hr_job_openings(status);

    CREATE TABLE IF NOT EXISTS hr_candidates (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      mobile TEXT,
      email TEXT,
      resume_media_id INTEGER,
      source TEXT NOT NULL DEFAULT 'site' CHECK(source IN ('site','referral','agency','other')),
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_process','hired','rejected','withdrawn')),
      converted_employee_id INTEGER REFERENCES hr_employees(id) ON DELETE SET NULL,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_candidates_status ON hr_candidates(status);

    -- R8: resume + interview data is sensitive. row/field scope over this
    -- table is enforced in the data layer (hr.recruitment), not by a column.
    CREATE TABLE IF NOT EXISTS hr_applications (
      id SERIAL PRIMARY KEY,
      candidate_id INTEGER NOT NULL REFERENCES hr_candidates(id) ON DELETE CASCADE,
      opening_id INTEGER NOT NULL REFERENCES hr_job_openings(id) ON DELETE CASCADE,
      stage TEXT NOT NULL DEFAULT 'screening'
        CHECK(stage IN ('screening','interview_1','interview_2','offer','rejected','hired')),
      note TEXT,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_applications_stage ON hr_applications(stage);
    CREATE INDEX IF NOT EXISTS idx_hr_applications_candidate ON hr_applications(candidate_id);

    CREATE TABLE IF NOT EXISTS hr_interviews (
      id SERIAL PRIMARY KEY,
      application_id INTEGER NOT NULL REFERENCES hr_applications(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'online' CHECK(kind IN ('onsite','online','phone')),
      scheduled_at TEXT,
      interviewer_id TEXT REFERENCES users(id),
      score INTEGER,
      note TEXT,
      result TEXT CHECK(result IN ('pending','pass','fail')) DEFAULT 'pending',
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_interviews_app ON hr_interviews(application_id);
    CREATE INDEX IF NOT EXISTS idx_hr_interviews_interviewer ON hr_interviews(interviewer_id);

    CREATE TABLE IF NOT EXISTS hr_offers (
      id SERIAL PRIMARY KEY,
      application_id INTEGER NOT NULL REFERENCES hr_applications(id) ON DELETE CASCADE,
      proposed_salary NUMERIC(16,2) NOT NULL,
      start_date TEXT,
      status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','accepted','rejected','expired')),
      approved_by TEXT REFERENCES users(id),
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_offers_app ON hr_offers(application_id);

    -- بند ۲ — training, riding on the EXISTING academy catalog.
    CREATE TABLE IF NOT EXISTS hr_training_enrollments (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      mandatory INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed','dropped')),
      score NUMERIC(6,2),
      enrolled_at TEXT NOT NULL DEFAULT (${NOW}),
      completed_at TEXT,
      company_id INTEGER,
      UNIQUE(employee_id, course_id)
    );
    CREATE INDEX IF NOT EXISTS idx_hr_train_enroll_emp ON hr_training_enrollments(employee_id, status);

    CREATE TABLE IF NOT EXISTS hr_training_certificates (
      id SERIAL PRIMARY KEY,
      enrollment_id INTEGER NOT NULL REFERENCES hr_training_enrollments(id) ON DELETE CASCADE,
      issued_at TEXT NOT NULL DEFAULT (${NOW}),
      expires_at TEXT,
      certificate_no TEXT NOT NULL,
      company_id INTEGER,
      UNIQUE(certificate_no)
    );

    -- بند ۳ — performance review. Append-only: a cycle's hr_reviews row is
    -- never edited after finalization; a correction is a NEW cycle, exactly
    -- the 28.1 employment-history discipline applied to review scores.
    CREATE TABLE IF NOT EXISTS hr_review_cycles (
      id SERIAL PRIMARY KEY,
      name_fa TEXT NOT NULL,
      name_en TEXT,
      period TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed')),
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS hr_review_templates (
      id SERIAL PRIMARY KEY,
      name_fa TEXT NOT NULL,
      name_en TEXT,
      criteria_json TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE IF NOT EXISTS hr_reviews (
      id SERIAL PRIMARY KEY,
      cycle_id INTEGER NOT NULL REFERENCES hr_review_cycles(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      reviewer_id INTEGER REFERENCES hr_employees(id) ON DELETE SET NULL,
      template_id INTEGER REFERENCES hr_review_templates(id) ON DELETE SET NULL,
      kind TEXT NOT NULL DEFAULT 'manager' CHECK(kind IN ('self','manager','peer','review_360')),
      scores_json TEXT NOT NULL DEFAULT '{}',
      overall_score NUMERIC(5,2),
      note TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','finalized')),
      approval_request_id INTEGER,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_reviews_cycle ON hr_reviews(cycle_id);
    CREATE INDEX IF NOT EXISTS idx_hr_reviews_emp ON hr_reviews(employee_id);
    CREATE INDEX IF NOT EXISTS idx_hr_reviews_reviewer ON hr_reviews(reviewer_id);

    CREATE TABLE IF NOT EXISTS hr_okrs (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES hr_employees(id) ON DELETE CASCADE,
      cycle_id INTEGER REFERENCES hr_review_cycles(id) ON DELETE SET NULL,
      objective TEXT NOT NULL,
      key_results_json TEXT NOT NULL DEFAULT '[]',
      progress_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_hr_okrs_emp ON hr_okrs(employee_id);

    -- Default approval rules for the two new doc types, same reasoning as
    -- hr_portal_request above: absence of a configured rule must read as
    -- "needs administrator sign-off", never as silent auto-approval.
    INSERT INTO approval_matrix (doc_type, name_en, name_fa, min_amount, levels, priority, active)
      SELECT 'hr_offer', 'Salary offer approval', 'تأیید پیشنهاد حقوق', 0,
             '[{"level":1,"mode":"any","approvers":[{"type":"role","ref":"administrator"},{"type":"role","ref":"super_admin"}]}]', 0, 1
      WHERE NOT EXISTS (SELECT 1 FROM approval_matrix WHERE doc_type='hr_offer');
    INSERT INTO approval_matrix (doc_type, name_en, name_fa, min_amount, levels, priority, active)
      SELECT 'hr_review', 'Performance review finalization', 'نهایی‌سازی ارزیابی عملکرد', 0,
             '[{"level":1,"mode":"any","approvers":[{"type":"role","ref":"administrator"},{"type":"role","ref":"super_admin"}]}]', 0, 1
      WHERE NOT EXISTS (SELECT 1 FROM approval_matrix WHERE doc_type='hr_review');

    -- ══ Phase 5 — Three-Way Match (PO / Receipt / Supplier Invoice) ══
    -- Line-level ancestry so an invoice line can be traced back to the exact
    -- receipt line (and, through it, the PO line) it was converted from.
    -- convertDocument() already copies lines 1:1 in sort_order when moving
    -- order→receipt→invoice — these columns just record that lineage instead
    -- of leaving it implicit. Self-referencing FK (nullable): a standalone
    -- invoice with no PO/receipt behind it simply leaves both null, which is
    -- the honest "nothing to match against" case (status 'pending', not a
    -- fabricated pass).
    ALTER TABLE purchase_document_lines ADD COLUMN IF NOT EXISTS po_line_id INTEGER REFERENCES purchase_document_lines(id);
    ALTER TABLE purchase_document_lines ADD COLUMN IF NOT EXISTS receipt_line_id INTEGER REFERENCES purchase_document_lines(id);
    ALTER TABLE purchase_document_lines ADD COLUMN IF NOT EXISTS match_status TEXT;
    ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS match_status TEXT;
    ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS match_checked_at TEXT;
    ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS match_override BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS match_override_reason TEXT;
    ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS match_override_by TEXT;
    CREATE INDEX IF NOT EXISTS idx_pur_lines_po_line ON purchase_document_lines(po_line_id);
    CREATE INDEX IF NOT EXISTS idx_pur_lines_receipt_line ON purchase_document_lines(receipt_line_id);
    -- Same off/warn/block precedent as 26.25's credit_guard_mode: default
    -- 'warn' so the payment gate never silently blocks the many legitimate
    -- standalone invoices this system already supports (no PO/receipt
    -- behind them), but a genuine mismatch is always surfaced.
    INSERT INTO erp_settings (key, value) VALUES ('three_way_match_mode','warn')
    ON CONFLICT (key) DO NOTHING;

    -- ══ Phase 6 — Sales ↔ Inventory ↔ Fulfillment ══
    -- sales_documents had NO warehouse concept at all — the minimal,
    -- additive schema decision needed before a sales order can reserve or
    -- deliver against real stock. Nullable: an order with no warehouse set
    -- simply never reserves (same "nothing to match against" honesty as
    -- Phase 5's standalone invoice).
    ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES inv_warehouses(id);
    -- inv_shipments already implements a real fulfillment state machine
    -- (Phase 26.19) but had zero structural link back to sales_documents —
    -- reused, not duplicated: one FK, not a second delivery table.
    ALTER TABLE inv_shipments ADD COLUMN IF NOT EXISTS sales_document_id INTEGER REFERENCES sales_documents(id);
    -- Idempotent COGS posting on the ship transition (Dr COGS / Cr Inventory).
    ALTER TABLE inv_shipments ADD COLUMN IF NOT EXISTS gl_entry_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_inv_shipments_sales_doc ON inv_shipments(sales_document_id);
  `)

  // Item 4 (bug-fix pack): complete vendor/supplier information collection.
  // purchase_vendors already carried kind/tax_id/economic_code/iban — this
  // adds the remaining identity/contact/banking fields an operator needs to
  // fully register a supplier (mirrors sales_customers' national_id/reg_no
  // party-identity pattern from Phase 26.2).
  await pgQuery(`
    ALTER TABLE purchase_vendors ADD COLUMN IF NOT EXISTS national_id TEXT;
    ALTER TABLE purchase_vendors ADD COLUMN IF NOT EXISTS reg_no TEXT;
    ALTER TABLE purchase_vendors ADD COLUMN IF NOT EXISTS contact_name TEXT;
    ALTER TABLE purchase_vendors ADD COLUMN IF NOT EXISTS contact_phone TEXT;
    ALTER TABLE purchase_vendors ADD COLUMN IF NOT EXISTS bank_name TEXT;
    ALTER TABLE purchase_vendors ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE purchase_vendors ADD COLUMN IF NOT EXISTS postal_code TEXT;
    ALTER TABLE purchase_vendors ADD COLUMN IF NOT EXISTS website TEXT;
    ALTER TABLE purchase_vendors ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE purchase_vendors ADD COLUMN IF NOT EXISTS notes TEXT;
  `)

  await pgQuery(`
    -- Phase 18: a memorandum/off-balance account type (حساب‌های انتظامی —
    -- guarantee notes, promissory notes held/given) for the statutory chart
    -- import below. normalSide()/trialBalance()/incomeStatement()/
    -- balanceSheet() only ever filter by the 5 original types, so a 'memo'
    -- account correctly never appears in any financial statement unless a
    -- future phase deliberately adds memo-ledger reporting — exactly the
    -- off-balance-sheet behavior these accounts require.
    ALTER TABLE gl_accounts DROP CONSTRAINT IF EXISTS gl_accounts_type_check;
    ALTER TABLE gl_accounts ADD CONSTRAINT gl_accounts_type_check
      CHECK (type IN ('asset','liability','equity','revenue','expense','memo'));
  `)

  await pgQuery(`
    -- Phase 18 (user-provided statutory coding workbook): the full Iranian
    -- chart of accounts, seeded as DATA (never hardcoded in posting logic)
    -- in 3 business-type variants (service/production/trading). An operator
    -- imports exactly ONE into their live gl_accounts via the Chart-of-
    -- Accounts Import feature (src/lib/erp/coaImportData.ts) — detail codes
    -- carry a DIFFERENT meaning per variant (e.g. 1601 is 'service contract'
    -- in the service chart, 'raw-material inventory' in production), so all
    -- three can never coexist live at once; this block only seeds the SOURCE
    -- templates (idempotent, UNIQUE(template_key,code)), never gl_accounts.
    CREATE TABLE IF NOT EXISTS coa_import_templates (
      key TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coa_import_nodes (
      id SERIAL PRIMARY KEY,
      template_key TEXT NOT NULL REFERENCES coa_import_templates(key) ON DELETE CASCADE,
      level TEXT NOT NULL CHECK(level IN ('group','control','detail')),
      code TEXT NOT NULL,
      parent_code TEXT,
      name_en TEXT,
      name_fa TEXT NOT NULL,
      account_type TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(template_key, code)
    );

    INSERT INTO coa_import_templates (key, name_en, name_fa) VALUES
      ('service', 'Service', 'خدماتی'),
      ('production', 'Production', 'تولیدی'),
      ('trading', 'Trading', 'بازرگانی')
    ON CONFLICT (key) DO NOTHING;

    INSERT INTO coa_import_nodes (template_key, level, code, parent_code, name_en, name_fa, account_type, sort_order) VALUES
      ('service', 'group', 'G1', NULL, 'Current Assets', 'دارایی‌های جاری', 'asset', 0),
      ('service', 'control', 'C1_11', 'G1', NULL, 'موجودی نقد', 'asset', 1),
      ('service', 'detail', '1101', 'C1_11', NULL, 'صندوق', 'asset', 2),
      ('service', 'detail', '1102', 'C1_11', NULL, 'بانک‌ها', 'asset', 3),
      ('service', 'detail', '1103', 'C1_11', NULL, 'تنخواه‌گردان‌ها', 'asset', 4),
      ('service', 'control', 'C1_12', 'G1', NULL, 'سرمایه‌گذاری‌های کوتاه‌مدت', 'asset', 5),
      ('service', 'detail', '1201', 'C1_12', NULL, 'سپرده‌ی سرمایه‌گذاری کوتاه‌مدت نزد بانک‌ها', 'asset', 6),
      ('service', 'detail', '1202', 'C1_12', NULL, 'سرمایه‌گذاری در سهام شرکت‌ها', 'asset', 7),
      ('service', 'detail', '1203', 'C1_12', NULL, 'اوراق مشارکت', 'asset', 8),
      ('service', 'detail', '1299', 'C1_12', NULL, 'ذخیره‌ی کاهش ارزش سرمایه‌گذاری‌های کوتاه‌مدت', 'asset', 9),
      ('service', 'control', 'C1_14', 'G1', NULL, 'حساب‌ها و اسناد دریافتنی تجاری', 'asset', 10),
      ('service', 'detail', '1401', 'C1_14', NULL, 'اسناد دریافتنی نزد صندوق', 'asset', 11),
      ('service', 'detail', '1403', 'C1_14', NULL, 'اسناد در جریان وصول نزد بانک‌ها', 'asset', 12),
      ('service', 'detail', '1498', 'C1_14', NULL, 'ذخیره‌ی مطالبات مشکوک‌الوصل اسناد', 'asset', 13),
      ('service', 'detail', '1411', 'C1_14', NULL, 'شرکت‌ها و موسسه‌ها و سازمان‌ها', 'asset', 14),
      ('service', 'detail', '1412', 'C1_14', NULL, 'اشخاص حقیقی', 'asset', 15),
      ('service', 'detail', '1421', 'C1_14', NULL, 'چک‌های برگشتی مشتریان', 'asset', 16),
      ('service', 'detail', '1499', 'C1_14', NULL, 'ذخیره‌ی مطالبات مشکوک‌الوصل حساب‌ها', 'asset', 17),
      ('service', 'control', 'C1_15', 'G1', NULL, 'سایر حساب‌های دریافتنی', 'asset', 18),
      ('service', 'detail', '1501', 'C1_15', NULL, 'شرکت‌ها، موسسه‌ها و سازمان‌ها', 'asset', 19),
      ('service', 'detail', '1502', 'C1_15', NULL, 'اشخاص حقیقی', 'asset', 20),
      ('service', 'detail', '1503', 'C1_15', NULL, 'وام کارکنان', 'asset', 21),
      ('service', 'detail', '1504', 'C1_15', NULL, 'مساعده‌ی کارکنان', 'asset', 22),
      ('service', 'detail', '1509', 'C1_15', NULL, 'سایر بدهکاران', 'asset', 23),
      ('service', 'detail', '1510', 'C1_15', NULL, 'مالیات بر ارزش افزوده', 'asset', 24),
      ('service', 'detail', '1521', 'C1_15', NULL, 'سپرده‌ی شرکت در مناقصه', 'asset', 25),
      ('service', 'detail', '1522', 'C1_15', NULL, 'سپرده‌ی حسن انجام کار', 'asset', 26),
      ('service', 'detail', '1523', 'C1_15', NULL, 'سپرده‌ی حسن انجام تعهدات', 'asset', 27),
      ('service', 'detail', '1524', 'C1_15', NULL, 'سپرده‌ی اخذ ضمانت‌نامه‌ی بانکی', 'asset', 28),
      ('service', 'detail', '1525', 'C1_15', NULL, 'سپرده‌ی اجاره', 'asset', 29),
      ('service', 'detail', '1526', 'C1_15', NULL, 'سایر سپرده‌ها', 'asset', 30),
      ('service', 'detail', '1599', 'C1_15', NULL, 'ذخیره‌ی مطالبات مشکوک‌الوصل', 'asset', 31),
      ('service', 'control', 'C1_16', 'G1', NULL, 'موجودی مواد و کالا', 'asset', 32),
      ('service', 'detail', '1601', 'C1_16', NULL, 'موجودی ملزومات اداری', 'asset', 33),
      ('service', 'detail', '1699', 'C1_16', NULL, 'ذخیره‌ی کاهش ارزش موجودی‌های جنسی', 'asset', 34),
      ('service', 'control', 'C1_17', 'G1', NULL, 'قراردادهای در دست اجرا', 'asset', 35),
      ('service', 'detail', '1701', 'C1_17', NULL, 'قرارداد ارائه‌ی خدمات', 'asset', 36),
      ('service', 'control', 'C1_18', 'G1', NULL, 'سفارش‌ها و پیش‌پرداخت‌ها', 'asset', 37),
      ('service', 'detail', '1801', 'C1_18', NULL, 'سفارش‌ها', 'asset', 38),
      ('service', 'detail', '1802', 'C1_18', NULL, 'پیش‌پرداخت خرید کالا و خدمات', 'asset', 39),
      ('service', 'detail', '1803', 'C1_18', NULL, 'پیش‌پرداخت مالیات عملکرد', 'asset', 40),
      ('service', 'detail', '1804', 'C1_18', NULL, 'پیش‌پرداخت اجاره', 'asset', 41),
      ('service', 'detail', '1805', 'C1_18', NULL, 'پیش‌پرداخت بیمه', 'asset', 42),
      ('service', 'detail', '1811', 'C1_18', NULL, 'سایر پیش‌پرداخت‌ها', 'asset', 43),
      ('service', 'control', 'C1_19', 'G1', NULL, 'دارایی‌های نگهداری‌شده برای فروش', 'asset', 44),
      ('service', 'detail', '1901', 'C1_19', NULL, 'وسایل نقلیه‌ی فرسوده برای فروش', 'asset', 45),
      ('service', 'detail', '1902', 'C1_19', NULL, 'اثاثیه و منصوبات خارج از رده برای فروش', 'asset', 46),
      ('service', 'group', 'G2', NULL, 'Non-current Assets', 'دارایی غیرجاری', 'asset', 47),
      ('service', 'control', 'C2_21', 'G2', NULL, 'حساب‌ها و اسناد دریافتنی بلندمدت', 'asset', 48),
      ('service', 'detail', '2101', 'C2_21', NULL, 'شرکت‌ها، موسسه‌ها و اشخاص', 'asset', 49),
      ('service', 'detail', '2102', 'C2_21', NULL, 'اسناد دریافتنی بلندمدت نزد صندوق', 'asset', 50),
      ('service', 'detail', '2103', 'C2_21', NULL, 'اسناد دریافتنی بلندمدت نزد بانک‌ها', 'asset', 51),
      ('service', 'detail', '2199', 'C2_21', NULL, 'ذخیره‌ی مطالبات مشکوک‌الوصول', 'asset', 52),
      ('service', 'control', 'C2_22', 'G2', NULL, 'سرمایه‌گذاری بلندمدت', 'asset', 53),
      ('service', 'detail', '2201', 'C2_22', NULL, 'سرمایه‌گذاری در سهام شرکت‌ها', 'asset', 54),
      ('service', 'detail', '2299', 'C2_22', NULL, 'ذخیره‌ی کاهش ارزش سرمایه‌گذاری‌های بلندمدت', 'asset', 55),
      ('service', 'control', 'C2_23', 'G2', NULL, 'سرمایه‌گذاری در املاک', 'asset', 56),
      ('service', 'detail', '2301', 'C2_23', NULL, 'سرمایه‌گذاری در املاک مسکونی', 'asset', 57),
      ('service', 'detail', '2302', 'C2_23', NULL, 'سرمایه‌گذاری در املاک تجاری', 'asset', 58),
      ('service', 'detail', '2303', 'C2_23', NULL, 'سرمایه‌گذاری در املاک اداری', 'asset', 59),
      ('service', 'control', 'C2_24', 'G2', NULL, 'دارایی‌های نامشهود', 'asset', 60),
      ('service', 'detail', '2401', 'C2_24', NULL, 'نرم‌افزارهای مالی', 'asset', 61),
      ('service', 'detail', '2402', 'C2_24', NULL, 'دانش فنی', 'asset', 62),
      ('service', 'detail', '2403', 'C2_24', NULL, 'سرقفلی', 'asset', 63),
      ('service', 'control', 'C2_25', 'G2', NULL, 'دارایی‌های ثابت مشهود', 'asset', 64),
      ('service', 'detail', '2501', 'C2_25', NULL, 'زمین', 'asset', 65),
      ('service', 'detail', '2502', 'C2_25', NULL, 'ساختمان', 'asset', 66),
      ('service', 'detail', '2503', 'C2_25', NULL, 'تاسیسات', 'asset', 67),
      ('service', 'detail', '2506', 'C2_25', NULL, 'وسایل نقلیه', 'asset', 68),
      ('service', 'detail', '2508', 'C2_25', NULL, 'اثاثیه و منصوبات', 'asset', 69),
      ('service', 'detail', '2511', 'C2_25', NULL, 'دارایی‌های در جریان ساخت', 'asset', 70),
      ('service', 'detail', '2522', 'C2_25', NULL, 'استهلاک انباشته‌ی ساختمان', 'asset', 71),
      ('service', 'detail', '2523', 'C2_25', NULL, 'استهلاک انباشته‌ی تاسیسات', 'asset', 72),
      ('service', 'detail', '2526', 'C2_25', NULL, 'استهلاک انباشته‌ی وسایل نقلیه', 'asset', 73),
      ('service', 'detail', '2528', 'C2_25', NULL, 'استهلاک انباشته‌ی اثاثیه و منصوبات', 'asset', 74),
      ('service', 'control', 'C2_26', 'G2', NULL, 'سایر دارایی‌ها', 'asset', 75),
      ('service', 'detail', '2601', 'C2_26', NULL, 'حق‌الامتیاز آب', 'asset', 76),
      ('service', 'detail', '2602', 'C2_26', NULL, 'حق‌الامتیاز برق', 'asset', 77),
      ('service', 'detail', '2603', 'C2_26', NULL, 'حق‌الامتیاز تلفن', 'asset', 78),
      ('service', 'detail', '2604', 'C2_26', NULL, 'حق‌الامتیاز گاز', 'asset', 79),
      ('service', 'detail', '2606', 'C2_26', NULL, 'هزینه‌های انتقالی به دوره‌های آتی', 'asset', 80),
      ('service', 'control', 'C2_29', 'G2', NULL, 'تراز افتتاحیه و اختتامیه', 'asset', 81),
      ('service', 'detail', '2901', 'C2_29', NULL, 'تراز افتتاحیه و اختتامیه', 'asset', 82),
      ('service', 'group', 'G3', NULL, 'Current Liabilities', 'بدهی‌های جاری', 'liability', 83),
      ('service', 'control', 'C3_31', 'G3', NULL, 'اسناد پرداختنی', 'liability', 84),
      ('service', 'detail', '3101', 'C3_31', NULL, 'اسناد پرداختنی ریالی', 'liability', 85),
      ('service', 'control', 'C3_32', 'G3', NULL, 'حساب‌های پرداختنی تجاری', 'liability', 86),
      ('service', 'detail', '3201', 'C3_32', NULL, 'شرکت‌ها، موسسه‌ها و سازمان‌ها', 'liability', 87),
      ('service', 'detail', '3202', 'C3_32', NULL, 'حساب‌های پرداختنی تجاری (اشخاص حقیقی)', 'liability', 88),
      ('service', 'control', 'C3_33', 'G3', NULL, 'سایر حساب‌های پرداختنی', 'liability', 89),
      ('service', 'detail', '3301', 'C3_33', NULL, 'سایر حساب‌های پرداختنی تجاری شرکت‌ه', 'liability', 90),
      ('service', 'detail', '3302', 'C3_33', NULL, 'سایر حساب‌های پرداختنی (اشخاص حقیقی)', 'liability', 91),
      ('service', 'detail', '3303', 'C3_33', NULL, 'حقوق و دستمزد پرداختنی', 'liability', 92),
      ('service', 'detail', '3304', 'C3_33', NULL, 'سازمان تامین اجتماعی (حق بیمه‌ی کارکنان)', 'liability', 93),
      ('service', 'detail', '3305', 'C3_33', NULL, 'اداره‌ی امور مالیاتی (مالیات حقوق)', 'liability', 94),
      ('service', 'detail', '3306', 'C3_33', NULL, 'اداره‌ی امور مالیاتی (مالیات تکلیفی)', 'liability', 95),
      ('service', 'detail', '3307', 'C3_33', NULL, 'اداره‌ی امور مالیاتی (مالیات ارزش افزوده)', 'liability', 96),
      ('service', 'detail', '3310', 'C3_33', NULL, 'جاری شریکان یا سهام‌داران', 'liability', 97),
      ('service', 'detail', '3311', 'C3_33', NULL, 'سپرده‌های دریافتی از شرکت‌ها و موسسه‌ها', 'liability', 98),
      ('service', 'detail', '3312', 'C3_33', NULL, 'سپرده‌های دریافتی از اشخاص حقیقی', 'liability', 99),
      ('service', 'detail', '3321', 'C3_33', NULL, 'رند حقوق', 'liability', 100),
      ('service', 'control', 'C3_34', 'G3', NULL, 'مالیات پرداختنی', 'liability', 101),
      ('service', 'detail', '3401', 'C3_34', NULL, 'مالیات پرداختنی سال ...', 'liability', 102),
      ('service', 'detail', '3402', 'C3_34', NULL, 'مالیات پرداختنی سال ...', 'liability', 103),
      ('service', 'control', 'C3_35', 'G3', NULL, 'سود سهام پرداختنی', 'liability', 104),
      ('service', 'detail', '3501', 'C3_35', NULL, 'سود سهام مصوب مجمع عمومی سال ...', 'liability', 105),
      ('service', 'detail', '3502', 'C3_35', NULL, 'سود سهام مصوب مجمع عمومی سال ...', 'liability', 106),
      ('service', 'control', 'C3_36', 'G3', NULL, 'تسهیلات مالی دریافتی کوتاه‌مدت', 'liability', 107),
      ('service', 'detail', '3601', 'C3_36', NULL, 'تسهیلات مالی دریافتی از بانک‌ها', 'liability', 108),
      ('service', 'detail', '3602', 'C3_36', NULL, 'تسهیلات مالی دریافتی از اشخاص', 'liability', 109),
      ('service', 'control', 'C3_38', 'G3', NULL, 'پیش‌دریافت‌ها و سپرده‌ها', 'liability', 110),
      ('service', 'detail', '3801', 'C3_38', NULL, 'پیش‌دریافت از شرکت‌ها، موسسه‌ها و سازمان‌ها', 'liability', 111),
      ('service', 'detail', '3802', 'C3_38', NULL, 'پیش‌دریافت از اشخاص حقیقی', 'liability', 112),
      ('service', 'control', 'C3_39', 'G3', NULL, 'بدهی‌های مرتبط با دارایی‌های نگهداری‌شده برای فروش', 'liability', 113),
      ('service', 'detail', '3901', 'C3_39', NULL, 'حق‌الزحمه‌ی پرداختنی کارشناس رسمی', 'liability', 114),
      ('service', 'group', 'G4', NULL, 'Long-term Liabilities', 'بدهی‌های بلندمدت', 'liability', 115),
      ('service', 'control', 'C4_41', 'G4', NULL, 'اسناد پرداختنی بلندمدت', 'liability', 116),
      ('service', 'detail', '4101', 'C4_41', NULL, 'اسناد پرداختنی سررسید سال‌های آتی', 'liability', 117),
      ('service', 'control', 'C4_42', 'G4', NULL, 'حساب‌های پرداختنی تجاری بلندمدت', 'liability', 118),
      ('service', 'detail', '4201', 'C4_42', NULL, 'شرکت‌ها، موسسه‌ها و سازمان‌ها', 'liability', 119),
      ('service', 'detail', '4202', 'C4_42', NULL, 'اشخاص حقیقی', 'liability', 120),
      ('service', 'control', 'C4_45', 'G4', NULL, 'تسهیلات مالی دریافتی بلندمدت', 'liability', 121),
      ('service', 'detail', '4501', 'C4_45', NULL, 'تسهیلات مالی دریافتی بلندمدت از بانک‌ها', 'liability', 122),
      ('service', 'control', 'C4_46', 'G4', NULL, 'ذخیره‌ی مزایای پایان خدمت', 'liability', 123),
      ('service', 'detail', '4601', 'C4_46', NULL, 'ذخیره‌ی مزایای پایان خدمت کارکنان', 'liability', 124),
      ('service', 'group', 'G5', NULL, 'Equity', 'حقوق صاحبان سهام', 'equity', 125),
      ('service', 'control', 'C5_51', 'G5', NULL, 'سرمایه', 'equity', 126),
      ('service', 'detail', '5101', 'C5_51', NULL, 'سرمایه', 'equity', 127),
      ('service', 'control', 'C5_52', 'G5', NULL, 'افزایش سرمایه‌ی در جریان', 'equity', 128),
      ('service', 'detail', '5201', 'C5_52', NULL, 'افزایش سرمایه از محل مطالبات سهام‌داران', 'equity', 129),
      ('service', 'detail', '5202', 'C5_52', NULL, 'افزایش سرمایه از محل آورده‌ی نقدی سهام‌داران', 'equity', 130),
      ('service', 'control', 'C5_53', 'G5', NULL, 'اندوخته‌ی صرف سهام', 'equity', 131),
      ('service', 'detail', '5301', 'C5_53', NULL, 'اندوخته‌ی صرف سهام افزایش سرمایه‌ی ...', 'equity', 132),
      ('service', 'detail', '5302', 'C5_53', NULL, 'اندوخته‌ی صرف سهام افزایش سرمایه‌ی ...', 'equity', 133),
      ('service', 'control', 'C5_54', 'G5', NULL, 'اندوخته‌ی قانونی', 'equity', 134),
      ('service', 'detail', '5401', 'C5_54', NULL, 'اندوخته‌ی قانونی', 'equity', 135),
      ('service', 'control', 'C5_55', 'G5', NULL, 'سایر اندوخته‌ها', 'equity', 136),
      ('service', 'detail', '5501', 'C5_55', NULL, 'اندوخته‌ی طرح توسعه', 'equity', 137),
      ('service', 'control', 'C5_56', 'G5', NULL, 'مازاد تجدید ارزیابی دارایی‌ها', 'equity', 138),
      ('service', 'detail', '5601', 'C5_56', NULL, 'ساختمان‌های اداری', 'equity', 139),
      ('service', 'control', 'C5_57', 'G5', NULL, 'تفاوت تسعیر ارز عملیات خارجی', 'equity', 140),
      ('service', 'detail', '5701', 'C5_57', NULL, 'تفاوت تسعیر ارز پیمان خارجی کشور ...', 'equity', 141),
      ('service', 'detail', '5702', 'C5_57', NULL, 'تفاوت تسعیر ارز عملیات پیمانکاری در دست اجرای', 'equity', 142),
      ('service', 'control', 'C5_58', 'G5', NULL, 'سود انباشته', 'equity', 143),
      ('service', 'detail', '5801', 'C5_58', NULL, 'سود و زیان انباشته', 'equity', 144),
      ('service', 'detail', '5802', 'C5_58', NULL, 'تعدیلات سنواتی طی دوره', 'equity', 145),
      ('service', 'detail', '5903', 'C5_58', NULL, 'حساب سود و زیان جاری', 'equity', 146),
      ('service', 'group', 'G6', NULL, 'Revenue', 'درآمدها', 'revenue', 147),
      ('service', 'control', 'C6_61', 'G6', NULL, 'درآمد خدمات', 'revenue', 148),
      ('service', 'detail', '6101', 'C6_61', NULL, 'درآمد ارائه‌ی خدمات', 'revenue', 149),
      ('service', 'detail', '6103', 'C6_61', NULL, 'درآمد خدمات از ...', 'revenue', 150),
      ('service', 'control', 'C6_62', 'G6', NULL, 'سایر درآمدهای عملیاتی', 'revenue', 151),
      ('service', 'detail', '6201', 'C6_62', NULL, 'سایر درآمد خدمات', 'revenue', 152),
      ('service', 'detail', '6203', 'C6_62', NULL, 'سایر درآمدهای عملیاتی', 'revenue', 153),
      ('service', 'group', 'G7', NULL, 'Expenses', 'هزینه‌ها', 'expense', 154),
      ('service', 'control', 'C7_71', 'G7', NULL, 'هزینه‌ی حقوق و دستمزد', 'expense', 155),
      ('service', 'detail', '7101', 'C7_71', NULL, 'حقوق پایه', 'expense', 156),
      ('service', 'detail', '7102', 'C7_71', NULL, 'اضافه‌کاری', 'expense', 157),
      ('service', 'detail', '7103', 'C7_71', NULL, 'خواربار و مسکن', 'expense', 158),
      ('service', 'detail', '7104', 'C7_71', NULL, 'حق اولاد', 'expense', 159),
      ('service', 'detail', '7105', 'C7_71', NULL, 'کمک‌هزینه‌ی اقلام مصرفی خانوار', 'expense', 160),
      ('service', 'detail', '7106', 'C7_71', NULL, 'نوبت کاری و شب‌کاری', 'expense', 161),
      ('service', 'detail', '7107', 'C7_71', NULL, '%23 حق بیمه‌ی سهم کارفرما', 'expense', 162),
      ('service', 'detail', '7108', 'C7_71', NULL, 'عیدی و پاداش', 'expense', 163),
      ('service', 'detail', '7109', 'C7_71', NULL, 'حق‌الجذب', 'expense', 164),
      ('service', 'detail', '7110', 'C7_71', NULL, 'بازخرید مرخصی استفاده‌نشده', 'expense', 165),
      ('service', 'detail', '7111', 'C7_71', NULL, 'مزایای پایان‌خدمت کارکنان', 'expense', 166),
      ('service', 'detail', '7112', 'C7_71', NULL, 'کمک‌های غیرنقدی', 'expense', 167),
      ('service', 'control', 'C7_72', 'G7', NULL, 'هزینه‌های عملیاتی', 'expense', 168),
      ('service', 'detail', '7202', 'C7_72', NULL, 'تعمیر و نگهداری ساختمان و تاسیسات', 'expense', 169),
      ('service', 'detail', '7203', 'C7_72', NULL, 'تعمیر و نگهداری ماشین‌آلات و تجهیزات', 'expense', 170),
      ('service', 'detail', '7204', 'C7_72', NULL, 'تعمیر و نگهداری وسائط نقلیه', 'expense', 171),
      ('service', 'detail', '7205', 'C7_72', NULL, 'تعمیر و نگهداری اثاثیه و منصوبات', 'expense', 172),
      ('service', 'detail', '7206', 'C7_72', NULL, 'سوخت و انرژی', 'expense', 173),
      ('service', 'detail', '7207', 'C7_72', NULL, 'آب، برق، گاز و تلفن', 'expense', 174),
      ('service', 'detail', '7208', 'C7_72', NULL, 'ملزومات، نوشت‌افزار و آگهی', 'expense', 175),
      ('service', 'detail', '7209', 'C7_72', NULL, 'آبدارخانه', 'expense', 176),
      ('service', 'detail', '7210', 'C7_72', NULL, 'حمل‌ونقل', 'expense', 177),
      ('service', 'detail', '7211', 'C7_72', NULL, 'اجاره‌ی مکان', 'expense', 178),
      ('service', 'detail', '7212', 'C7_72', NULL, 'بیمه‌ی دارایی‌ها', 'expense', 179),
      ('service', 'detail', '7213', 'C7_72', NULL, 'استهلاک دارایی‌ها', 'expense', 180),
      ('service', 'detail', '7214', 'C7_72', NULL, 'ملزومات مصرفی', 'expense', 181),
      ('service', 'detail', '7215', 'C7_72', NULL, 'ایاب‌و‌ذهاب', 'expense', 182),
      ('service', 'detail', '7216', 'C7_72', NULL, 'هزینه‌ی غذای کارکنان', 'expense', 183),
      ('service', 'detail', '7217', 'C7_72', NULL, 'هزینه‌ی پیک و پست', 'expense', 184),
      ('service', 'detail', '7218', 'C7_72', NULL, 'پوشاک کارکنان', 'expense', 185),
      ('service', 'detail', '7219', 'C7_72', NULL, 'بهداشت و درمان', 'expense', 186),
      ('service', 'detail', '7220', 'C7_72', NULL, 'هزینه‌ی سفر و ماموریت', 'expense', 187),
      ('service', 'detail', '7221', 'C7_72', NULL, 'کارمزدهای بانکی', 'expense', 188),
      ('service', 'detail', '7222', 'C7_72', NULL, 'هزینه‌های بسته‌بندی', 'expense', 189),
      ('service', 'detail', '7226', 'C7_72', NULL, 'حق‌المشاوره', 'expense', 190),
      ('service', 'detail', '7227', 'C7_72', NULL, 'هزینه‌های رایانه‌ای', 'expense', 191),
      ('service', 'detail', '7228', 'C7_72', NULL, 'هزینه‌ی ثبتی، حق تمبر و وکالت', 'expense', 192),
      ('service', 'control', 'C7_73', 'G7', NULL, 'هزینه‌های توزیع و فروش', 'expense', 193),
      ('service', 'detail', '7301', 'C7_73', NULL, 'هزینه‌های تبلیغات، بازاریابی، کاتالوگ و بروشور', 'expense', 194),
      ('service', 'detail', '7302', 'C7_73', NULL, 'هزینه‌ی انبارداری', 'expense', 195),
      ('service', 'detail', '7303', 'C7_73', NULL, 'کمیسیون‌های پرداختی', 'expense', 196),
      ('service', 'detail', '7304', 'C7_73', NULL, 'هزینه‌ی حمل‌ونقل کالای فروش‌رفته', 'expense', 197),
      ('service', 'detail', '7305', 'C7_73', NULL, 'هزینه‌ی مطالبات مشکوک‌الوصول و سوخت‌شده', 'expense', 198),
      ('service', 'detail', '7306', 'C7_73', NULL, 'پاداش هیئت‌مدیره', 'expense', 199),
      ('service', 'control', 'C7_74', 'G7', NULL, 'سایر اقلام عملیاتی', 'expense', 200),
      ('service', 'detail', '7402', 'C7_74', NULL, 'سود و زیان ناشی از تسعیر دارایی‌ها و بدهی‌های ارزی عملیاتی', 'expense', 201),
      ('service', 'detail', '7403', 'C7_74', NULL, 'درآمد اجاره', 'expense', 202),
      ('service', 'detail', '7404', 'C7_74', NULL, 'زیان کاهش ارزش موجودی‌ها', 'expense', 203),
      ('service', 'control', 'C7_75', 'G7', NULL, 'هزینه‌های مالی', 'expense', 204),
      ('service', 'detail', '7501', 'C7_75', NULL, 'سود تضمین‌شده و کارمزد تسهیلات دریافتی', 'expense', 205),
      ('service', 'detail', '7502', 'C7_75', NULL, 'هزینه‌ی خرید سفته', 'expense', 206),
      ('service', 'detail', '7503', 'C7_75', NULL, 'هزینه‌ی خدمات حسابداری و حسابرسی', 'expense', 207),
      ('service', 'detail', '7504', 'C7_75', NULL, 'کارمزد صدور ضمانت‌نامه‌های بانکی', 'expense', 208),
      ('service', 'detail', '7505', 'C7_75', NULL, 'هزینه‌ی رهن املاک', 'expense', 209),
      ('service', 'control', 'C7_76', 'G7', NULL, 'سایر درآمدها و هزینه‌های غیرعملیاتی', 'expense', 210),
      ('service', 'detail', '7601', 'C7_76', NULL, 'سود و زیان ناشی از فروش دارایی‌های ثابت مشهود و نامشهود', 'expense', 211),
      ('service', 'detail', '7602', 'C7_76', NULL, 'سود سپرده‌های بانکی و سایر اوراق بهادار', 'expense', 212),
      ('service', 'detail', '7604', 'C7_76', NULL, 'سود سهام', 'expense', 213),
      ('service', 'detail', '7605', 'C7_76', NULL, 'زیان کاهش ارزش سرمایه‌گذاری‌های بلندمدت', 'expense', 214),
      ('service', 'detail', '7606', 'C7_76', NULL, 'سود ناشی از فروش سرمایه‌گذاری‌ها', 'expense', 215),
      ('service', 'detail', '7607', 'C7_76', NULL, 'درآمد و هزینه‌ی ناشی از ارزیابی سرمایه‌گذاری‌های جاری سریع‌المعامله به ارزش بازار', 'expense', 216),
      ('service', 'detail', '7608', 'C7_76', NULL, 'سود و زیان تسعیر دارایی‌ها و بدهی‌های ارزی غیرمرتبط با عملیات', 'expense', 217),
      ('service', 'group', 'G9', NULL, 'Memo Accounts', 'حساب‌های انتظامی', 'memo', 218),
      ('service', 'control', 'C9_91', 'G9', NULL, 'حساب‌های انتظامی', 'memo', 219),
      ('service', 'detail', '9101', 'C9_91', NULL, 'اسناد تضمینی ما نزد دیگران', 'memo', 220),
      ('service', 'detail', '9102', 'C9_91', NULL, 'سفته‌های تضمینی ما نزد دیگران', 'memo', 221),
      ('service', 'detail', '9103', 'C9_91', NULL, 'ضمانت‌نامه‌های بانکی ما نزد دیگران', 'memo', 222),
      ('service', 'detail', '9104', 'C9_91', NULL, 'اسناد تضمینی دیگران نزد ما', 'memo', 223),
      ('service', 'control', 'C9_92', 'G9', NULL, 'طرف حساب‌های انتظامی', 'memo', 224),
      ('service', 'detail', '9201', 'C9_92', NULL, 'طرف اسناد تضمینی ما نزد دیگران', 'memo', 225),
      ('service', 'detail', '9202', 'C9_92', NULL, 'طرف سفته‌های تضمینی ما نزد دیگران', 'memo', 226),
      ('service', 'detail', '9203', 'C9_92', NULL, 'طرف ضمانت‌نامه‌های بانکی ما نزد دیگران', 'memo', 227),
      ('service', 'detail', '9204', 'C9_92', NULL, 'طرف اسناد تضمینی دیگران نزد ما', 'memo', 228)
    ON CONFLICT (template_key, code) DO NOTHING;

    INSERT INTO coa_import_nodes (template_key, level, code, parent_code, name_en, name_fa, account_type, sort_order) VALUES
      ('production', 'group', 'G1', NULL, 'Current Assets', 'دارایی‌های جاری', 'asset', 0),
      ('production', 'control', 'C1_11', 'G1', NULL, 'موجودی نقد', 'asset', 1),
      ('production', 'detail', '1101', 'C1_11', NULL, 'صندوق', 'asset', 2),
      ('production', 'detail', '1102', 'C1_11', NULL, 'بانک‌ها', 'asset', 3),
      ('production', 'detail', '1103', 'C1_11', NULL, 'تنخواه‌گردان‌ها', 'asset', 4),
      ('production', 'control', 'C1_12', 'G1', NULL, 'سرمایه‌گذاری‌های کوتاه‌مدت', 'asset', 5),
      ('production', 'detail', '1201', 'C1_12', NULL, 'سپرده‌ی سرمایه‌گذاری کوتاه‌مدت نزد بانک‌ها', 'asset', 6),
      ('production', 'detail', '1202', 'C1_12', NULL, 'سرمایه‌گذاری در سهام شرکت‌ها', 'asset', 7),
      ('production', 'detail', '1203', 'C1_12', NULL, 'اوراق مشارکت', 'asset', 8),
      ('production', 'detail', '1299', 'C1_12', NULL, 'ذخیره‌ی کاهش ارزش سرمایه‌گذاری‌های کوتاه‌مدت', 'asset', 9),
      ('production', 'control', 'C1_14', 'G1', NULL, 'حساب‌ها و اسناد دریافتنی تجاری', 'asset', 10),
      ('production', 'detail', '1401', 'C1_14', NULL, 'اسناد دریافتنی نزد صندوق', 'asset', 11),
      ('production', 'detail', '1403', 'C1_14', NULL, 'اسناد در جریان وصول نزد بانک‌ها', 'asset', 12),
      ('production', 'detail', '1411', 'C1_14', NULL, 'شرکت‌ها و موسسه‌ها و سازمان‌ها', 'asset', 13),
      ('production', 'detail', '1412', 'C1_14', NULL, 'اشخاص حقیقی', 'asset', 14),
      ('production', 'detail', '1421', 'C1_14', NULL, 'چک‌های برگشتی مشتریان', 'asset', 15),
      ('production', 'detail', '1499', 'C1_14', NULL, 'ذخیره‌ی مطالبات مشکوک‌الوصل حساب‌ها', 'asset', 16),
      ('production', 'control', 'C1_15', 'G1', NULL, 'سایر حساب‌های دریافتنی', 'asset', 17),
      ('production', 'detail', '1501', 'C1_15', NULL, 'شرکت‌ها، موسسه‌ها و سازمان‌ها', 'asset', 18),
      ('production', 'detail', '1502', 'C1_15', NULL, 'اشخاص حقیقی', 'asset', 19),
      ('production', 'detail', '1503', 'C1_15', NULL, 'وام کارکنان', 'asset', 20),
      ('production', 'detail', '1504', 'C1_15', NULL, 'مساعده‌ی کارکنان', 'asset', 21),
      ('production', 'detail', '1509', 'C1_15', NULL, 'سایر بدهکاران', 'asset', 22),
      ('production', 'detail', '1510', 'C1_15', NULL, 'مالیات بر ارزش افزوده', 'asset', 23),
      ('production', 'detail', '1521', 'C1_15', NULL, 'سپرده‌ی شرکت در مناقصه', 'asset', 24),
      ('production', 'detail', '1522', 'C1_15', NULL, 'سپرده‌ی حسن انجام کار', 'asset', 25),
      ('production', 'detail', '1523', 'C1_15', NULL, 'سپرده‌ی حسن انجام تعهدات', 'asset', 26),
      ('production', 'detail', '1524', 'C1_15', NULL, 'سپرده‌ی اخذ ضمانت‌نامه‌ی بانکی', 'asset', 27),
      ('production', 'detail', '1525', 'C1_15', NULL, 'سپرده‌ی اجاره', 'asset', 28),
      ('production', 'detail', '1526', 'C1_15', NULL, 'سایر سپرده‌ها', 'asset', 29),
      ('production', 'detail', '1599', 'C1_15', NULL, 'ذخیره‌ی مطالبات مشکوک‌الوصل', 'asset', 30),
      ('production', 'control', 'C1_16', 'G1', NULL, 'موجودی مواد و کالا', 'asset', 31),
      ('production', 'detail', '1601', 'C1_16', NULL, 'موجودی مواد و مصالح', 'asset', 32),
      ('production', 'detail', '1605', 'C1_16', NULL, 'موجودی لوازم فنی و یدکی', 'asset', 33),
      ('production', 'detail', '1699', 'C1_16', NULL, 'ذخیره‌ی کاهش ارزش موجودی‌های جنسی', 'asset', 34),
      ('production', 'control', 'C1_17', 'G1', NULL, 'پروژه‌ها و پیمان‌های در دست اجرا', 'asset', 35),
      ('production', 'detail', '1701', 'C1_17', NULL, 'پروژه‌ی پیمانکاری راه‌سازی ...', 'asset', 36),
      ('production', 'detail', '1702', 'C1_17', NULL, 'پروژه‌ی پیمانکاری سدسازی ...', 'asset', 37),
      ('production', 'control', 'C1_18', 'G1', NULL, 'سفارش‌ها و پیش‌پرداخت‌ها', 'asset', 38),
      ('production', 'detail', '1801', 'C1_18', NULL, 'سفارش‌های مواد اولیه', 'asset', 39),
      ('production', 'detail', '1802', 'C1_18', NULL, 'پیش‌پرداخت خرید کالا و خدمات', 'asset', 40),
      ('production', 'detail', '1803', 'C1_18', NULL, 'پیش‌پرداخت مالیات عملکرد', 'asset', 41),
      ('production', 'detail', '1804', 'C1_18', NULL, 'پیش‌پرداخت اجاره', 'asset', 42),
      ('production', 'detail', '1805', 'C1_18', NULL, 'پیش‌پرداخت بیمه', 'asset', 43),
      ('production', 'detail', '1811', 'C1_18', NULL, 'سایر پیش‌پرداخت‌ها', 'asset', 44),
      ('production', 'control', 'C1_19', 'G1', NULL, 'دارایی‌های نگهداری‌شده برای فروش', 'asset', 45),
      ('production', 'detail', '1901', 'C1_19', NULL, 'وسایل نقلیه‌ی فرسوده برای فروش', 'asset', 46),
      ('production', 'detail', '1902', 'C1_19', NULL, 'اثاثیه و منصوبات خارج از رده برای فروش', 'asset', 47),
      ('production', 'group', 'G2', NULL, 'Non-current Assets', 'دارایی غیرجاری', 'asset', 48),
      ('production', 'control', 'C2_21', 'G2', NULL, 'حساب‌ها و اسناد دریافتنی بلندمدت', 'asset', 49),
      ('production', 'detail', '2101', 'C2_21', NULL, 'شرکت‌ها، موسسه‌ها و اشخاص', 'asset', 50),
      ('production', 'detail', '2102', 'C2_21', NULL, 'اسناد دریافتنی بلندمدت نزد صندوق', 'asset', 51),
      ('production', 'detail', '2103', 'C2_21', NULL, 'اسناد دریافتنی بلندمدت نزد بانک‌ها', 'asset', 52),
      ('production', 'detail', '2199', 'C2_21', NULL, 'ذخیره‌ی مطالبات مشکوک‌الوصول', 'asset', 53),
      ('production', 'control', 'C2_22', 'G2', NULL, 'سرمایه‌گذاری بلندمدت', 'asset', 54),
      ('production', 'detail', '2201', 'C2_22', NULL, 'سرمایه‌گذاری در سهام شرکت‌ها', 'asset', 55),
      ('production', 'detail', '2299', 'C2_22', NULL, 'ذخیره‌ی کاهش ارزش سرمایه‌گذاری‌های بلندمدت', 'asset', 56),
      ('production', 'control', 'C2_23', 'G2', NULL, 'سرمایه‌گذاری در املاک', 'asset', 57),
      ('production', 'detail', '2301', 'C2_23', NULL, 'سرمایه‌گذاری در املاک مسکونی', 'asset', 58),
      ('production', 'detail', '2302', 'C2_23', NULL, 'سرمایه‌گذاری در املاک تجاری', 'asset', 59),
      ('production', 'detail', '2303', 'C2_23', NULL, 'سرمایه‌گذاری در املاک اداری', 'asset', 60),
      ('production', 'control', 'C2_24', 'G2', NULL, 'دارایی‌های نامشهود', 'asset', 61),
      ('production', 'detail', '2401', 'C2_24', NULL, 'نرم‌افزارهای مالی', 'asset', 62),
      ('production', 'detail', '2402', 'C2_24', NULL, 'دانش فنی', 'asset', 63),
      ('production', 'detail', '2403', 'C2_24', NULL, 'سرقفلی', 'asset', 64),
      ('production', 'control', 'C2_25', 'G2', NULL, 'دارایی‌های ثابت مشهود', 'asset', 65),
      ('production', 'detail', '2501', 'C2_25', NULL, 'زمین', 'asset', 66),
      ('production', 'detail', '2502', 'C2_25', NULL, 'ساختمان', 'asset', 67),
      ('production', 'detail', '2503', 'C2_25', NULL, 'تاسیسات', 'asset', 68),
      ('production', 'detail', '2504', 'C2_25', NULL, 'ماشین‌آلات و تجهیزات سنگین کارگاهی', 'asset', 69),
      ('production', 'detail', '2505', 'C2_25', NULL, 'ابزارآلات کارگاهی', 'asset', 70),
      ('production', 'detail', '2506', 'C2_25', NULL, 'وسایل نقلیه', 'asset', 71),
      ('production', 'detail', '2508', 'C2_25', NULL, 'اثاثیه و منصوبات', 'asset', 72),
      ('production', 'detail', '2511', 'C2_25', NULL, 'دارایی‌های در جریان ساخت', 'asset', 73),
      ('production', 'detail', '2522', 'C2_25', NULL, 'استهلاک انباشته‌ی ساختمان', 'asset', 74),
      ('production', 'detail', '2523', 'C2_25', NULL, 'استهلاک انباشته‌ی تاسیسات', 'asset', 75),
      ('production', 'detail', '2524', 'C2_25', NULL, 'استهلاک انباشته‌ی ماشین‌آلات و تجهیزات کارگاهی', 'asset', 76),
      ('production', 'detail', '2525', 'C2_25', NULL, 'استهلاک انباشته‌ی ابزارآلات کارگاهی', 'asset', 77),
      ('production', 'detail', '2526', 'C2_25', NULL, 'استهلاک انباشته‌ی وسایل نقلیه', 'asset', 78),
      ('production', 'detail', '2528', 'C2_25', NULL, 'استهلاک انباشته‌ی اثاثیه و منصوبات', 'asset', 79),
      ('production', 'control', 'C2_26', 'G2', NULL, 'سایر دارایی‌ها', 'asset', 80),
      ('production', 'detail', '2601', 'C2_26', NULL, 'حق‌الامتیاز آب', 'asset', 81),
      ('production', 'detail', '2602', 'C2_26', NULL, 'حق‌الامتیاز برق', 'asset', 82),
      ('production', 'detail', '2603', 'C2_26', NULL, 'حق‌الامتیاز تلفن', 'asset', 83),
      ('production', 'detail', '2604', 'C2_26', NULL, 'حق‌الامتیاز گاز', 'asset', 84),
      ('production', 'detail', '2606', 'C2_26', NULL, 'هزینه‌های انتقالی به دوره‌های آتی', 'asset', 85),
      ('production', 'control', 'C2_29', 'G2', NULL, 'تراز افتتاحیه و اختتامیه', 'asset', 86),
      ('production', 'detail', '2901', 'C2_29', NULL, 'تراز افتتاحیه و اختتامیه', 'asset', 87),
      ('production', 'group', 'G3', NULL, 'Current Liabilities', 'بدهی‌های جاری', 'liability', 88),
      ('production', 'control', 'C3_31', 'G3', NULL, 'اسناد پرداختنی', 'liability', 89),
      ('production', 'detail', '3101', 'C3_31', NULL, 'اسناد پرداختنی ریالی', 'liability', 90),
      ('production', 'control', 'C3_32', 'G3', NULL, 'حساب‌های پرداختنی تجاری', 'liability', 91),
      ('production', 'detail', '3201', 'C3_32', NULL, 'حساب‌های پرداختنی تجاری شرکت‌ها، موسسه‌ها و سازمان‌ها', 'liability', 92),
      ('production', 'detail', '3202', 'C3_32', NULL, 'حساب‌های پرداختنی تجاری (اشخاص حقیقی)', 'liability', 93),
      ('production', 'control', 'C3_33', 'G3', NULL, 'سایر حساب‌های پرداختنی', 'liability', 94),
      ('production', 'detail', '3301', 'C3_33', NULL, 'سایر حساب‌های پرداختنی تجاری شرکت‌ها، موسسه‌ها و سازمان‌ها', 'liability', 95),
      ('production', 'detail', '3302', 'C3_33', NULL, 'سایر حساب‌های پرداختنی (اشخاص حقیقی)', 'liability', 96),
      ('production', 'detail', '3303', 'C3_33', NULL, 'حقوق و دستمزد پرداختنی', 'liability', 97),
      ('production', 'detail', '3304', 'C3_33', NULL, 'سازمان تامین اجتماعی (حق بیمه‌ی کارکنان)', 'liability', 98),
      ('production', 'detail', '3305', 'C3_33', NULL, 'اداره‌ی امور مالیاتی (مالیات حقوق)', 'liability', 99),
      ('production', 'detail', '3306', 'C3_33', NULL, 'اداره‌ی امور مالیاتی (مالیات تکلیفی)', 'liability', 100),
      ('production', 'detail', '3307', 'C3_33', NULL, 'اداره‌ی امور مالیاتی (مالیات ارزش افزوده)', 'liability', 101),
      ('production', 'detail', '3310', 'C3_33', NULL, 'جاری شریکان یا سهام‌داران', 'liability', 102),
      ('production', 'detail', '3311', 'C3_33', NULL, 'ذخیره‌ی هزینه‌های تحقق‌یافته‌ی پرداخت‌نشده', 'liability', 103),
      ('production', 'detail', '3321', 'C3_33', NULL, 'رند حقوق', 'liability', 104),
      ('production', 'control', 'C3_34', 'G3', NULL, 'مالیات پرداختنی', 'liability', 105),
      ('production', 'detail', '3401', 'C3_34', NULL, 'مالیات پرداختنی سال …', 'liability', 106),
      ('production', 'detail', '3402', 'C3_34', NULL, 'مالیات پرداختنی سال …', 'liability', 107),
      ('production', 'control', 'C3_35', 'G3', NULL, 'سود سهام پرداختنی', 'liability', 108),
      ('production', 'detail', '3501', 'C3_35', NULL, 'سود سهام مصوب مجمع عمومی سال …', 'liability', 109),
      ('production', 'detail', '3502', 'C3_35', NULL, 'سود سهام مصوب مجمع عمومی سال …', 'liability', 110),
      ('production', 'control', 'C3_36', 'G3', NULL, 'تسهیلات مالی دریافتی کوتاه‌مدت', 'liability', 111),
      ('production', 'detail', '3601', 'C3_36', NULL, 'تسهیلات مالی دریافتی از بانک‌ها', 'liability', 112),
      ('production', 'detail', '3602', 'C3_36', NULL, 'تسهیلات مالی دریافتی از اشخاص', 'liability', 113),
      ('production', 'control', 'C3_37', 'G3', NULL, 'پیش‌دریافت‌ها و سپرده‌ها', 'liability', 114),
      ('production', 'detail', '3701', 'C3_37', NULL, 'پیش‌دریافت از شرکت‌ها، موسسه‌ها و سازمان‌ها', 'liability', 115),
      ('production', 'detail', '3702', 'C3_37', NULL, 'پیش‌دریافت از اشخاص حقیقی', 'liability', 116),
      ('production', 'detail', '3711', 'C3_37', NULL, 'سپرده‌های دریافتی از شرکت‌ها و موسسه‌ها', 'liability', 117),
      ('production', 'detail', '3712', 'C3_37', NULL, 'سپرده‌های دریافتی از اشخاص حقیقی', 'liability', 118),
      ('production', 'control', 'C3_38', 'G3', NULL, 'بدهی‌های مرتبط با دارایی‌های نگهداری‌شده برای فروش', 'liability', 119),
      ('production', 'detail', '3801', 'C3_38', NULL, 'حق‌الزحمه‌ی پرداختنی کارشناس رسمی', 'liability', 120),
      ('production', 'group', 'G4', NULL, 'Long-term Liabilities', 'بدهی‌های بلندمدت', 'liability', 121),
      ('production', 'control', 'C4_41', 'G4', NULL, 'اسناد پرداختنی بلندمدت', 'liability', 122),
      ('production', 'detail', '4101', 'C4_41', NULL, 'اسناد پرداختنی سررسید سال‌های آتی', 'liability', 123),
      ('production', 'control', 'C4_42', 'G4', NULL, 'حساب‌های پرداختنی تجاری بلندمدت', 'liability', 124),
      ('production', 'detail', '4201', 'C4_42', NULL, 'شرکت‌ها، موسسه‌ها و سازمان‌ها', 'liability', 125),
      ('production', 'detail', '4202', 'C4_42', NULL, 'اشخاص حقیقی', 'liability', 126),
      ('production', 'control', 'C4_43', 'G4', NULL, 'تسهیلات مالی دریافتی بلندمدت', 'liability', 127),
      ('production', 'detail', '4301', 'C4_43', NULL, 'تسهیلات مالی دریافتی بلندمدت از بانک‌ها', 'liability', 128),
      ('production', 'control', 'C4_44', 'G4', NULL, 'ذخیره‌ی مزایای پایان خدمت', 'liability', 129),
      ('production', 'detail', '4401', 'C4_44', NULL, 'ذخیره‌ی مزایای پایان خدمت کارکنان', 'liability', 130),
      ('production', 'group', 'G5', NULL, 'Equity', 'حقوق صاحبان سهام', 'equity', 131),
      ('production', 'control', 'C5_51', 'G5', NULL, 'سرمایه', 'equity', 132),
      ('production', 'detail', '5101', 'C5_51', NULL, 'سرمایه', 'equity', 133),
      ('production', 'control', 'C5_52', 'G5', NULL, 'افزایش سرمایه‌ی در جریان', 'equity', 134),
      ('production', 'detail', '5201', 'C5_52', NULL, 'افزایش سرمایه از محل مطالبات سهام‌داران', 'equity', 135),
      ('production', 'detail', '5202', 'C5_52', NULL, 'افزایش سرمایه از محل آورده‌ی نقدی سهام‌داران', 'equity', 136),
      ('production', 'control', 'C5_53', 'G5', NULL, 'اندوخته‌ی صرف سهام', 'equity', 137),
      ('production', 'detail', '5301', 'C5_53', NULL, 'اندوخته‌ی صرف سهام افزایش سرمایه‌ی …', 'equity', 138),
      ('production', 'detail', '5302', 'C5_53', NULL, 'اندوخته‌ی صرف سهام افزایش سرمایه‌ی …', 'equity', 139),
      ('production', 'control', 'C5_54', 'G5', NULL, 'اندوخته‌ی قانونی', 'equity', 140),
      ('production', 'detail', '5401', 'C5_54', NULL, 'اندوخته‌ی قانونی', 'equity', 141),
      ('production', 'control', 'C5_55', 'G5', NULL, 'سایر اندوخته‌ها', 'equity', 142),
      ('production', 'detail', '5501', 'C5_55', NULL, 'اندوخته‌ی طرح توسعه', 'equity', 143),
      ('production', 'control', 'C5_56', 'G5', NULL, 'مازاد تجدید ارزیابی دارایی‌ها', 'equity', 144),
      ('production', 'detail', '5601', 'C5_56', NULL, 'ساختمان‌های اداری', 'equity', 145),
      ('production', 'detail', '5602', 'C5_56', NULL, 'ماشین‌آلات و تجهیزات', 'equity', 146),
      ('production', 'control', 'C5_57', 'G5', NULL, 'تفاوت تسعیر ارز عملیات خارجی', 'equity', 147),
      ('production', 'detail', '5701', 'C5_57', NULL, 'تفاوت تسعیر ارز پیمان خارجی کشور ...', 'equity', 148),
      ('production', 'detail', '5702', 'C5_57', NULL, 'تفاوت تسعیر ارز عملیات پیمانکاری در دست اجرای کشور ...', 'equity', 149),
      ('production', 'control', 'C5_58', 'G5', NULL, 'سود انباشته', 'equity', 150),
      ('production', 'detail', '5801', 'C5_58', NULL, 'سود و زیان انباشته', 'equity', 151),
      ('production', 'detail', '5802', 'C5_58', NULL, 'تعدیلات سنواتی طی دوره', 'equity', 152),
      ('production', 'control', 'C5_59', 'G5', NULL, 'عملکرد سود و زیان', 'equity', 153),
      ('production', 'detail', '5901', 'C5_59', NULL, 'حساب عملکرد پیمانکاری', 'equity', 154),
      ('production', 'detail', '5902', 'C5_59', NULL, 'حساب عملکرد خدمات کارمزدی', 'equity', 155),
      ('production', 'detail', '5903', 'C5_59', NULL, 'حساب سود و زیان جاری', 'equity', 156),
      ('production', 'group', 'G6', NULL, 'Revenue', 'درآمدها', 'revenue', 157),
      ('production', 'control', 'C6_61', 'G6', NULL, 'فروش', 'revenue', 158),
      ('production', 'detail', '6101', 'C6_61', NULL, 'درآمد حاصل از قراردادهای پیمانکاری', 'revenue', 159),
      ('production', 'control', 'C6_62', 'G6', NULL, 'سایر درآمدهای عملیاتی', 'revenue', 160),
      ('production', 'detail', '6201', 'C6_62', NULL, 'درآمد خدمات کارمزدی', 'revenue', 161),
      ('production', 'detail', '6203', 'C6_62', NULL, 'سایر درآمدهای عملیاتی', 'revenue', 162),
      ('production', 'group', 'G7', NULL, 'Expenses', 'هزینه‌ها', 'expense', 163),
      ('production', 'control', 'C7_71', 'G7', NULL, 'هزینه‌ی حقوق و دستمزد', 'expense', 164),
      ('production', 'detail', '7101', 'C7_71', NULL, 'حقوق پایه', 'expense', 165),
      ('production', 'detail', '7102', 'C7_71', NULL, 'اضافه‌کاری', 'expense', 166),
      ('production', 'detail', '7103', 'C7_71', NULL, 'خواربار و مسکن', 'expense', 167),
      ('production', 'detail', '7104', 'C7_71', NULL, 'حق اولاد', 'expense', 168),
      ('production', 'detail', '7105', 'C7_71', NULL, 'کمک‌هزینه‌ی اقلام مصرفی خانوار', 'expense', 169),
      ('production', 'detail', '7106', 'C7_71', NULL, 'نوبت کاری و شب‌کاری', 'expense', 170),
      ('production', 'detail', '7107', 'C7_71', NULL, '%23 حق بیمه‌ی سهم کارفرما', 'expense', 171),
      ('production', 'detail', '7108', 'C7_71', NULL, 'عیدی و پاداش', 'expense', 172),
      ('production', 'detail', '7109', 'C7_71', NULL, 'حق‌الجذب', 'expense', 173),
      ('production', 'detail', '7110', 'C7_71', NULL, 'بازخرید مرخصی استفاده‌نشده', 'expense', 174),
      ('production', 'detail', '7111', 'C7_71', NULL, 'مزایای پایان‌خدمت کارکنان', 'expense', 175),
      ('production', 'detail', '7112', 'C7_71', NULL, 'کمک‌های غیرنقدی', 'expense', 176),
      ('production', 'control', 'C7_72', 'G7', NULL, 'هزینه‌های عملیاتی', 'expense', 177),
      ('production', 'detail', '7201', 'C7_72', NULL, 'مواد و مصالح مصرفی در پروژه', 'expense', 178),
      ('production', 'detail', '7202', 'C7_72', NULL, 'تعمیر و نگهداری ساختمان و تاسیسات', 'expense', 179),
      ('production', 'detail', '7203', 'C7_72', NULL, 'تعمیر و نگهداری ماشین‌آلات و تجهیزات', 'expense', 180),
      ('production', 'detail', '7204', 'C7_72', NULL, 'تعمیر و نگهداری وسائط نقلیه', 'expense', 181),
      ('production', 'detail', '7205', 'C7_72', NULL, 'تعمیر و نگهداری اثاثیه و منصوبات', 'expense', 182),
      ('production', 'detail', '7206', 'C7_72', NULL, 'سوخت و انرژی', 'expense', 183),
      ('production', 'detail', '7207', 'C7_72', NULL, 'آب، برق، گاز و تلفن', 'expense', 184),
      ('production', 'detail', '7208', 'C7_72', NULL, 'ملزومات، نوشت‌افزار و آگهی', 'expense', 185),
      ('production', 'detail', '7209', 'C7_72', NULL, 'آبدارخانه', 'expense', 186),
      ('production', 'detail', '7210', 'C7_72', NULL, 'حمل‌ونقل', 'expense', 187),
      ('production', 'detail', '7211', 'C7_72', NULL, 'اجاره‌ی مکان', 'expense', 188),
      ('production', 'detail', '7212', 'C7_72', NULL, 'بیمه‌ی دارایی‌ها', 'expense', 189),
      ('production', 'detail', '7213', 'C7_72', NULL, 'استهلاک دارایی‌ها', 'expense', 190),
      ('production', 'detail', '7214', 'C7_72', NULL, 'ملزومات مصرفی در پروژه‌ها', 'expense', 191),
      ('production', 'detail', '7215', 'C7_72', NULL, 'ایاب‌و‌ذهاب', 'expense', 192),
      ('production', 'detail', '7216', 'C7_72', NULL, 'هزینه‌ی غذای کارکنان', 'expense', 193),
      ('production', 'detail', '7217', 'C7_72', NULL, 'هزینه‌ی پیک و پست', 'expense', 194),
      ('production', 'detail', '7218', 'C7_72', NULL, 'پوشاک کارکنان', 'expense', 195),
      ('production', 'detail', '7219', 'C7_72', NULL, 'بهداشت و درمان', 'expense', 196),
      ('production', 'detail', '7220', 'C7_72', NULL, 'هزینه‌ی سفر و ماموریت', 'expense', 197),
      ('production', 'detail', '7221', 'C7_72', NULL, 'کارمزدهای بانکی', 'expense', 198),
      ('production', 'detail', '7222', 'C7_72', NULL, 'هزینه‌های بسته‌بندی', 'expense', 199),
      ('production', 'detail', '7226', 'C7_72', NULL, 'حق‌المشاوره', 'expense', 200),
      ('production', 'detail', '7227', 'C7_72', NULL, 'هزینه‌های رایانه‌ای', 'expense', 201),
      ('production', 'detail', '7228', 'C7_72', NULL, 'هزینه‌ی ثبتی، حق تمبر و وکالت', 'expense', 202),
      ('production', 'detail', '7229', 'C7_72', NULL, 'هزینه‌ی اجاره‌ی ماشین‌آلات', 'expense', 203),
      ('production', 'detail', '7230', 'C7_72', NULL, 'هزینه‌های پیمانکاران دست‌دوم', 'expense', 204),
      ('production', 'detail', '7231', 'C7_72', NULL, 'هزینه‌ی دستمزد کارگران روزمزدی', 'expense', 205),
      ('production', 'control', 'C7_73', 'G7', NULL, 'هزینه‌های توزیع و فروش', 'expense', 206),
      ('production', 'detail', '7301', 'C7_73', NULL, 'هزینه‌های تبلیغات، بازاریابی، کاتالوگ و بروشور', 'expense', 207),
      ('production', 'detail', '7302', 'C7_73', NULL, 'هزینه‌ی انبارداری', 'expense', 208),
      ('production', 'detail', '7303', 'C7_73', NULL, 'بیمه‌ی مواد و مصالح', 'expense', 209),
      ('production', 'detail', '7304', 'C7_73', NULL, 'کمیسیون‌های پرداختی', 'expense', 210),
      ('production', 'detail', '7305', 'C7_73', NULL, 'هزینه‌ی حمل‌ونقل مواد و مصالح فروش‌رفته', 'expense', 211),
      ('production', 'detail', '7306', 'C7_73', NULL, 'هزینه‌ی مطالبات مشکوک‌الوصول و سوخت‌شده', 'expense', 212),
      ('production', 'detail', '7307', 'C7_73', NULL, 'پاداش هیئت‌مدیره', 'expense', 213),
      ('production', 'control', 'C7_74', 'G7', NULL, 'سایر اقلام عملیاتی', 'expense', 214),
      ('production', 'detail', '7401', 'C7_74', NULL, 'فروش مواد و مصالح ضایعاتی', 'expense', 215),
      ('production', 'detail', '7402', 'C7_74', NULL, 'سود و زیان ناشی از تسعیر دارایی‌ها و بدهی‌های ارزی عملیاتی', 'expense', 216),
      ('production', 'detail', '7403', 'C7_74', NULL, 'درآمد اجاره', 'expense', 217),
      ('production', 'detail', '7404', 'C7_74', NULL, 'زیان کاهش ارزش موجودی‌ها', 'expense', 218),
      ('production', 'detail', '7405', 'C7_74', NULL, 'خالص کسری و اضافی انبارها', 'expense', 219),
      ('production', 'control', 'C7_75', 'G7', NULL, 'هزینه‌های مالی', 'expense', 220),
      ('production', 'detail', '7501', 'C7_75', NULL, 'سود تضمین‌شده و کارمزد تسهیلات دریافتی', 'expense', 221),
      ('production', 'detail', '7502', 'C7_75', NULL, 'هزینه‌ی خرید سفته', 'expense', 222),
      ('production', 'detail', '7503', 'C7_75', NULL, 'هزینه‌ی خدمات حسابداری و حسابرسی', 'expense', 223),
      ('production', 'detail', '7504', 'C7_75', NULL, 'کارمزد صدور ضمانت‌نامه‌های بانکی', 'expense', 224),
      ('production', 'detail', '7505', 'C7_75', NULL, 'هزینه‌ی رهن املاک', 'expense', 225),
      ('production', 'control', 'C7_76', 'G7', NULL, 'سایر درآمدها و هزینه‌های غیرعملیاتی', 'expense', 226),
      ('production', 'detail', '7601', 'C7_76', NULL, 'سود و زیان ناشی از فروش دارایی‌های ثابت مشهود و نامشهود', 'expense', 227),
      ('production', 'detail', '7602', 'C7_76', NULL, 'سود سپرده‌های بانکی و سایر اوراق بهادار', 'expense', 228),
      ('production', 'detail', '7603', 'C7_76', NULL, 'سود حاصل از فروش مواد و مصالح', 'expense', 229),
      ('production', 'detail', '7604', 'C7_76', NULL, 'سود سهام', 'expense', 230),
      ('production', 'detail', '7605', 'C7_76', NULL, 'زیان کاهش ارزش سرمایه‌گذاری‌های بلندمدت', 'expense', 231),
      ('production', 'detail', '7606', 'C7_76', NULL, 'سود ناشی از فروش سرمایه‌گذاری‌ها', 'expense', 232),
      ('production', 'detail', '7607', 'C7_76', NULL, 'درآمد و هزینه‌ی ناشی از ارزیابی سرمایه‌گذاری‌های جاری سریع‌المعامله به ارزش بازار', 'expense', 233),
      ('production', 'detail', '7608', 'C7_76', NULL, 'سود و زیان تسعیر دارایی‌ها و بدهی‌های ارزی غیرمرتبط با عملیات', 'expense', 234),
      ('production', 'group', 'G9', NULL, 'Memo Accounts', 'حساب‌های انتظامی', 'memo', 235),
      ('production', 'control', 'C9_91', 'G9', NULL, 'حساب‌های انتظامی', 'memo', 236),
      ('production', 'detail', '9101', 'C9_91', NULL, 'اسناد تضمینی ما نزد دیگران', 'memo', 237),
      ('production', 'detail', '9102', 'C9_91', NULL, 'سفته‌های تضمینی ما نزد دیگران', 'memo', 238),
      ('production', 'detail', '9103', 'C9_91', NULL, 'ضمانت‌نامه‌های بانکی ما نزد دیگران', 'memo', 239),
      ('production', 'detail', '9104', 'C9_91', NULL, 'اسناد تضمینی دیگران نزد ما', 'memo', 240),
      ('production', 'control', 'C9_92', 'G9', NULL, 'طرف حساب‌های انتظامی', 'memo', 241),
      ('production', 'detail', '9201', 'C9_92', NULL, 'طرف اسناد تضمینی ما نزد دیگران', 'memo', 242),
      ('production', 'detail', '9202', 'C9_92', NULL, 'طرف سفته‌های تضمینی ما نزد دیگران', 'memo', 243),
      ('production', 'detail', '9203', 'C9_92', NULL, 'طرف ضمانت‌نامه‌های بانکی ما نزد دیگران', 'memo', 244),
      ('production', 'detail', '9204', 'C9_92', NULL, 'طرف اسناد تضمینی دیگران نزد ما', 'memo', 245)
    ON CONFLICT (template_key, code) DO NOTHING;

    INSERT INTO coa_import_nodes (template_key, level, code, parent_code, name_en, name_fa, account_type, sort_order) VALUES
      ('trading', 'group', 'G1', NULL, 'Current Assets', 'دارایی‌های جاری', 'asset', 0),
      ('trading', 'control', 'C1_11', 'G1', NULL, 'موجودی نقد', 'asset', 1),
      ('trading', 'detail', '1101', 'C1_11', NULL, 'صندوق', 'asset', 2),
      ('trading', 'detail', '1102', 'C1_11', NULL, 'بانک‌ها', 'asset', 3),
      ('trading', 'detail', '1103', 'C1_11', NULL, 'تنخواه‌گردان‌ها', 'asset', 4),
      ('trading', 'control', 'C1_12', 'G1', NULL, 'سرمایه‌گذاری‌های کوتاه‌مدت', 'asset', 5),
      ('trading', 'detail', '1201', 'C1_12', NULL, 'سپرده‌ی سرمایه‌گذاری کوتاه‌مدت نزد بانک‌ها', 'asset', 6),
      ('trading', 'detail', '1202', 'C1_12', NULL, 'سرمایه‌گذاری در سهام شرکت‌ها', 'asset', 7),
      ('trading', 'detail', '1203', 'C1_12', NULL, 'اوراق مشارکت', 'asset', 8),
      ('trading', 'detail', '1299', 'C1_12', NULL, 'ذخیره‌ی کاهش ارزش سرمایه‌گذاری‌های کوتاه‌مدت', 'asset', 9),
      ('trading', 'control', 'C1_14', 'G1', NULL, 'حساب‌ها و اسناد دریافتنی تجاری', 'asset', 10),
      ('trading', 'detail', '1401', 'C1_14', NULL, 'اسناد دریافتنی نزد صندوق', 'asset', 11),
      ('trading', 'detail', '1403', 'C1_14', NULL, 'اسناد در جریان وصول نزد بانک‌ها', 'asset', 12),
      ('trading', 'detail', '1498', 'C1_14', NULL, 'ذخیره‌ی مطالبات مشکوک‌الوصل اسناد', 'asset', 13),
      ('trading', 'detail', '1411', 'C1_14', NULL, 'شرکت‌ها و موسسه‌ها و سازمان‌ها', 'asset', 14),
      ('trading', 'detail', '1412', 'C1_14', NULL, 'اشخاص حقیقی', 'asset', 15),
      ('trading', 'detail', '1421', 'C1_14', NULL, 'چک‌های برگشتی مشتریان', 'asset', 16),
      ('trading', 'detail', '1499', 'C1_14', NULL, 'ذخیره‌ی مطالبات مشکوک‌الوصل حساب‌ها', 'asset', 17),
      ('trading', 'control', 'C1_15', 'G1', NULL, 'سایر حساب‌های دریافتنی', 'asset', 18),
      ('trading', 'detail', '1501', 'C1_15', NULL, 'شرکت‌ها، موسسه‌ها و سازمان‌ها', 'asset', 19),
      ('trading', 'detail', '1502', 'C1_15', NULL, 'اشخاص حقیقی', 'asset', 20),
      ('trading', 'detail', '1503', 'C1_15', NULL, 'وام کارکنان', 'asset', 21),
      ('trading', 'detail', '1504', 'C1_15', NULL, 'مساعده‌ی کارکنان', 'asset', 22),
      ('trading', 'detail', '1509', 'C1_15', NULL, 'سایر بدهکاران', 'asset', 23),
      ('trading', 'detail', '1510', 'C1_15', NULL, 'مالیات بر ارزش افزوده', 'asset', 24),
      ('trading', 'detail', '1521', 'C1_15', NULL, 'سپرده‌ی شرکت در مناقصه', 'asset', 25),
      ('trading', 'detail', '1522', 'C1_15', NULL, 'سپرده‌ی حسن انجام کار', 'asset', 26),
      ('trading', 'detail', '1523', 'C1_15', NULL, 'سپرده‌ی حسن انجام تعهدات', 'asset', 27),
      ('trading', 'detail', '1524', 'C1_15', NULL, 'سپرده‌ی اخذ ضمانت‌نامه‌ی بانکی', 'asset', 28),
      ('trading', 'detail', '1525', 'C1_15', NULL, 'سپرده‌ی اجاره', 'asset', 29),
      ('trading', 'detail', '1526', 'C1_15', NULL, 'سایر سپرده‌ها', 'asset', 30),
      ('trading', 'detail', '1599', 'C1_15', NULL, 'ذخیره‌ی مطالبات مشکوک‌الوصل', 'asset', 31),
      ('trading', 'control', 'C1_17', 'G1', NULL, 'موجودی مواد و کالا', 'asset', 32),
      ('trading', 'detail', '1701', 'C1_17', NULL, 'موجودی کالای بازرگانی', 'asset', 33),
      ('trading', 'detail', '1703', 'C1_17', NULL, 'سایر موجودی‌ها', 'asset', 34),
      ('trading', 'detail', '1799', 'C1_17', NULL, 'ذخیره‌ی کاهش ارزش موجودی', 'asset', 35),
      ('trading', 'control', 'C1_18', 'G1', NULL, 'سفارش‌ها و پیش‌پرداخت‌ها', 'asset', 36),
      ('trading', 'detail', '1801', 'C1_18', NULL, 'سفارش‌های واردات کالا', 'asset', 37),
      ('trading', 'detail', '1802', 'C1_18', NULL, 'پیش‌پرداخت خرید کالا و خدمات', 'asset', 38),
      ('trading', 'detail', '1803', 'C1_18', NULL, 'پیش‌پرداخت مالیات عملکرد', 'asset', 39),
      ('trading', 'detail', '1804', 'C1_18', NULL, 'پیش‌پرداخت اجاره', 'asset', 40),
      ('trading', 'detail', '1805', 'C1_18', NULL, 'پیش‌پرداخت بیمه', 'asset', 41),
      ('trading', 'detail', '1811', 'C1_18', NULL, 'سایر پیش‌پرداخت‌ها', 'asset', 42),
      ('trading', 'control', 'C1_19', 'G1', NULL, 'دارایی‌های نگهداری‌شده برای فروش', 'asset', 43),
      ('trading', 'detail', '1901', 'C1_19', NULL, 'وسایل نقلیه‌ی فرسوده برای فروش', 'asset', 44),
      ('trading', 'detail', '1902', 'C1_19', NULL, 'اثاثیه و منصوبات خارج از رده برای فروش', 'asset', 45),
      ('trading', 'group', 'G2', NULL, 'Non-current Assets', 'دارایی غیرجاری', 'asset', 46),
      ('trading', 'control', 'C2_21', 'G2', NULL, 'حساب‌ها و اسناد دریافتنی بلندمدت', 'asset', 47),
      ('trading', 'detail', '2101', 'C2_21', NULL, 'شرکت‌ها، موسسه‌ها و اشخاص', 'asset', 48),
      ('trading', 'detail', '2102', 'C2_21', NULL, 'اسناد دریافتنی بلندمدت نزد صندوق', 'asset', 49),
      ('trading', 'detail', '2103', 'C2_21', NULL, 'اسناد دریافتنی بلندمدت نزد بانک‌ها', 'asset', 50),
      ('trading', 'detail', '2199', 'C2_21', NULL, 'ذخیره‌ی مطالبات مشکوک‌الوصول', 'asset', 51),
      ('trading', 'control', 'C2_22', 'G2', NULL, 'سرمایه‌گذاری بلندمدت', 'asset', 52),
      ('trading', 'detail', '2201', 'C2_22', NULL, 'سرمایه‌گذاری در سهام شرکت‌ها', 'asset', 53),
      ('trading', 'detail', '2299', 'C2_22', NULL, 'ذخیره‌ی کاهش ارزش سرمایه‌گذاری‌های بلندمدت', 'asset', 54),
      ('trading', 'control', 'C2_23', 'G2', NULL, 'سرمایه‌گذاری در املاک', 'asset', 55),
      ('trading', 'detail', '2301', 'C2_23', NULL, 'سرمایه‌گذاری در املاک مسکونی', 'asset', 56),
      ('trading', 'detail', '2302', 'C2_23', NULL, 'سرمایه‌گذاری در املاک تجاری', 'asset', 57),
      ('trading', 'detail', '2303', 'C2_23', NULL, 'سرمایه‌گذاری در املاک اداری', 'asset', 58),
      ('trading', 'control', 'C2_24', 'G2', NULL, 'دارایی‌های نامشهود', 'asset', 59),
      ('trading', 'detail', '2401', 'C2_24', NULL, 'نرم‌افزارهای مالی', 'asset', 60),
      ('trading', 'detail', '2402', 'C2_24', NULL, 'دانش فنی', 'asset', 61),
      ('trading', 'detail', '2403', 'C2_24', NULL, 'سرقفلی', 'asset', 62),
      ('trading', 'control', 'C2_25', 'G2', NULL, 'دارایی‌های ثابت مشهود', 'asset', 63),
      ('trading', 'detail', '2501', 'C2_25', NULL, 'زمین', 'asset', 64),
      ('trading', 'detail', '2502', 'C2_25', NULL, 'ساختمان', 'asset', 65),
      ('trading', 'detail', '2503', 'C2_25', NULL, 'تاسیسات', 'asset', 66),
      ('trading', 'detail', '2506', 'C2_25', NULL, 'وسایل نقلیه', 'asset', 67),
      ('trading', 'detail', '2508', 'C2_25', NULL, 'اثاثیه و منصوبات', 'asset', 68),
      ('trading', 'detail', '2511', 'C2_25', NULL, 'دارایی‌های در جریان ساخت', 'asset', 69),
      ('trading', 'detail', '2522', 'C2_25', NULL, 'استهلاک انباشته‌ی ساختمان', 'asset', 70),
      ('trading', 'detail', '2523', 'C2_25', NULL, 'استهلاک انباشته‌ی تاسیسات', 'asset', 71),
      ('trading', 'detail', '2526', 'C2_25', NULL, 'استهلاک انباشته‌ی وسایل نقلیه', 'asset', 72),
      ('trading', 'detail', '2528', 'C2_25', NULL, 'استهلاک انباشته‌ی اثاثیه و منصوبات', 'asset', 73),
      ('trading', 'control', 'C2_26', 'G2', NULL, 'سایر دارایی‌ها', 'asset', 74),
      ('trading', 'detail', '2601', 'C2_26', NULL, 'حق‌الامتیاز آب', 'asset', 75),
      ('trading', 'detail', '2602', 'C2_26', NULL, 'حق‌الامتیاز برق', 'asset', 76),
      ('trading', 'detail', '2603', 'C2_26', NULL, 'حق‌الامتیاز تلفن', 'asset', 77),
      ('trading', 'detail', '2604', 'C2_26', NULL, 'حق‌الامتیاز گاز', 'asset', 78),
      ('trading', 'detail', '2606', 'C2_26', NULL, 'هزینه‌های انتقالی به دوره‌های آتی', 'asset', 79),
      ('trading', 'control', 'C2_29', 'G2', NULL, 'تراز افتتاحیه و اختتامیه', 'asset', 80),
      ('trading', 'detail', '2901', 'C2_29', NULL, 'تراز افتتاحیه و اختتامیه', 'asset', 81),
      ('trading', 'group', 'G3', NULL, 'Current Liabilities', 'بدهی‌های جاری', 'liability', 82),
      ('trading', 'control', 'C3_31', 'G3', NULL, 'اسناد پرداختنی', 'liability', 83),
      ('trading', 'detail', '3101', 'C3_31', NULL, 'اسناد پرداختنی ریالی', 'liability', 84),
      ('trading', 'control', 'C3_32', 'G3', NULL, 'حساب‌های پرداختنی تجاری', 'liability', 85),
      ('trading', 'detail', '3201', 'C3_32', NULL, 'حساب‌های پرداختنی تجاری شرکت‌ها، موسسه‌ها و سازمان‌ها', 'liability', 86),
      ('trading', 'detail', '3202', 'C3_32', NULL, 'حساب‌های پرداختنی تجاری (اشخاص حقیقی)', 'liability', 87),
      ('trading', 'control', 'C3_33', 'G3', NULL, 'سایر حساب‌های پرداختنی', 'liability', 88),
      ('trading', 'detail', '3301', 'C3_33', NULL, 'سایر حساب‌های پرداختنی تجاری شرکت‌ها، موسسه‌ها و سازمان‌ها', 'liability', 89),
      ('trading', 'detail', '3302', 'C3_33', NULL, 'سایر حساب‌های پرداختنی (اشخاص حقیقی)', 'liability', 90),
      ('trading', 'detail', '3303', 'C3_33', NULL, 'حقوق و دستمزد پرداختنی', 'liability', 91),
      ('trading', 'detail', '3304', 'C3_33', NULL, 'سازمان تامین اجتماعی (حق بیمه‌ی کارکنان)', 'liability', 92),
      ('trading', 'detail', '3305', 'C3_33', NULL, 'اداره‌ی امور مالیاتی (مالیات حقوق)', 'liability', 93),
      ('trading', 'detail', '3306', 'C3_33', NULL, 'اداره‌ی امور مالیاتی (مالیات تکلیفی)', 'liability', 94),
      ('trading', 'detail', '3307', 'C3_33', NULL, 'اداره‌ی امور مالیاتی (مالیات ارزش افزوده)', 'liability', 95),
      ('trading', 'detail', '3310', 'C3_33', NULL, 'جاری شریکان یا سهام‌داران', 'liability', 96),
      ('trading', 'detail', '3311', 'C3_33', NULL, 'سپرده‌های دریافتی از شرکت‌ها و موسسه‌ها', 'liability', 97),
      ('trading', 'detail', '3312', 'C3_33', NULL, 'سپرده‌های دریافتی از اشخاص حقیقی', 'liability', 98),
      ('trading', 'detail', '3321', 'C3_33', NULL, 'رند حقوق', 'liability', 99),
      ('trading', 'control', 'C3_34', 'G3', NULL, 'مالیات پرداختنی', 'liability', 100),
      ('trading', 'detail', '3401', 'C3_34', NULL, 'مالیات پرداختنی سال ...', 'liability', 101),
      ('trading', 'detail', '3402', 'C3_34', NULL, 'مالیات پرداختنی سال ...', 'liability', 102),
      ('trading', 'control', 'C3_35', 'G3', NULL, 'سود سهام پرداختنی', 'liability', 103),
      ('trading', 'detail', '3501', 'C3_35', NULL, 'سود سهام مصوب مجمع عمومی سال ...', 'liability', 104),
      ('trading', 'detail', '3502', 'C3_35', NULL, 'سود سهام مصوب مجمع عمومی سال ...', 'liability', 105),
      ('trading', 'control', 'C3_36', 'G3', NULL, 'تسهیلات مالی دریافتی کوتاه‌مدت', 'liability', 106),
      ('trading', 'detail', '3601', 'C3_36', NULL, 'تسهیلات مالی دریافتی از بانک‌ها', 'liability', 107),
      ('trading', 'detail', '3602', 'C3_36', NULL, 'تسهیلات مالی دریافتی از اشخاص', 'liability', 108),
      ('trading', 'control', 'C3_38', 'G3', NULL, 'پیش‌دریافت‌ها و سپرده‌ها', 'liability', 109),
      ('trading', 'detail', '3801', 'C3_38', NULL, 'پیش‌دریافت از شرکت‌ها، موسسه‌ها و سازمان‌ها', 'liability', 110),
      ('trading', 'detail', '3802', 'C3_38', NULL, 'پیش‌دریافت از اشخاص حقیقی', 'liability', 111),
      ('trading', 'control', 'C3_39', 'G3', NULL, 'بدهی‌های مرتبط با دارایی‌های نگهداری‌شده برای فروش', 'liability', 112),
      ('trading', 'detail', '3901', 'C3_39', NULL, 'حق‌الزحمه‌ی پرداختنی کارشناس رسمی', 'liability', 113),
      ('trading', 'group', 'G4', NULL, 'Long-term Liabilities', 'بدهی‌های بلندمدت', 'liability', 114),
      ('trading', 'control', 'C4_41', 'G4', NULL, 'اسناد پرداختنی بلندمدت', 'liability', 115),
      ('trading', 'detail', '4101', 'C4_41', NULL, 'اسناد پرداختنی سررسید سال‌های آتی', 'liability', 116),
      ('trading', 'control', 'C4_42', 'G4', NULL, 'حساب‌های پرداختنی تجاری بلندمدت', 'liability', 117),
      ('trading', 'detail', '4201', 'C4_42', NULL, 'شرکت‌ها، موسسه‌ها و سازمان‌ها', 'liability', 118),
      ('trading', 'detail', '4202', 'C4_42', NULL, 'اشخاص حقیقی', 'liability', 119),
      ('trading', 'control', 'C4_45', 'G4', NULL, 'تسهیلات مالی دریافتی بلندمدت', 'liability', 120),
      ('trading', 'detail', '4501', 'C4_45', NULL, 'تسهیلات مالی دریافتی بلندمدت از بانک‌ها', 'liability', 121),
      ('trading', 'control', 'C4_46', 'G4', NULL, 'ذخیره‌ی مزایای پایان خدمت', 'liability', 122),
      ('trading', 'detail', '4601', 'C4_46', NULL, 'ذخیره‌ی مزایای پایان خدمت کارکنان', 'liability', 123),
      ('trading', 'group', 'G5', NULL, 'Equity', 'حقوق صاحبان سهام', 'equity', 124),
      ('trading', 'control', 'C5_51', 'G5', NULL, 'سرمایه', 'equity', 125),
      ('trading', 'detail', '5101', 'C5_51', NULL, 'سرمایه', 'equity', 126),
      ('trading', 'control', 'C5_52', 'G5', NULL, 'افزایش سرمایه‌ی در جریان', 'equity', 127),
      ('trading', 'detail', '5201', 'C5_52', NULL, 'افزایش سرمایه از محل مطالبات سهام‌داران', 'equity', 128),
      ('trading', 'detail', '5202', 'C5_52', NULL, 'افزایش سرمایه از محل آورده‌ی نقدی سهام‌داران', 'equity', 129),
      ('trading', 'control', 'C5_53', 'G5', NULL, 'اندوخته‌ی صرف سهام', 'equity', 130),
      ('trading', 'detail', '5301', 'C5_53', NULL, 'اندوخته‌ی صرف سهام افزایش سرمایه‌ی ...', 'equity', 131),
      ('trading', 'detail', '5302', 'C5_53', NULL, 'اندوخته‌ی صرف سهام افزایش سرمایه‌ی ...', 'equity', 132),
      ('trading', 'control', 'C5_54', 'G5', NULL, 'اندوخته‌ی قانونی', 'equity', 133),
      ('trading', 'detail', '5401', 'C5_54', NULL, 'اندوخته‌ی قانونی', 'equity', 134),
      ('trading', 'control', 'C5_55', 'G5', NULL, 'سایر اندوخته‌ها', 'equity', 135),
      ('trading', 'detail', '5501', 'C5_55', NULL, 'اندوخته‌ی طرح توسعه', 'equity', 136),
      ('trading', 'control', 'C5_56', 'G5', NULL, 'مازاد تجدید ارزیابی دارایی‌ها', 'equity', 137),
      ('trading', 'detail', '5601', 'C5_56', NULL, 'ساختمان‌های اداری', 'equity', 138),
      ('trading', 'detail', '5602', 'C5_56', NULL, 'ماشین‌آلات و تجهیزات', 'equity', 139),
      ('trading', 'control', 'C5_57', 'G5', NULL, 'تفاوت تسعیر ارز عملیات خارجی', 'equity', 140),
      ('trading', 'detail', '5701', 'C5_57', NULL, 'تفاوت تسعیر ارز پیمان خارجی کشور ...', 'equity', 141),
      ('trading', 'detail', '5702', 'C5_57', NULL, 'تفاوت تسعیر ارز عملیات پیمانکاری در دست اجرای کشور ...', 'equity', 142),
      ('trading', 'control', 'C5_58', 'G5', NULL, 'سود انباشته', 'equity', 143),
      ('trading', 'detail', '5801', 'C5_58', NULL, 'سود و زیان انباشته', 'equity', 144),
      ('trading', 'detail', '5802', 'C5_58', NULL, 'تعدیلات سنواتی طی دوره', 'equity', 145),
      ('trading', 'control', 'C5_59', 'G5', NULL, 'عملکرد سود و زیان', 'equity', 146),
      ('trading', 'detail', '5901', 'C5_59', NULL, 'حساب عملکرد فروش', 'equity', 147),
      ('trading', 'detail', '5903', 'C5_59', NULL, 'حساب سود و زیان جاری', 'equity', 148),
      ('trading', 'group', 'G6', NULL, 'Revenue', 'درآمدها', 'revenue', 149),
      ('trading', 'control', 'C6_61', 'G6', NULL, 'فروش', 'revenue', 150),
      ('trading', 'detail', '6101', 'C6_61', NULL, 'فروش کالا', 'revenue', 151),
      ('trading', 'control', 'C6_62', 'G6', NULL, 'سایر درآمدهای عملیاتی', 'revenue', 152),
      ('trading', 'detail', '6201', 'C6_62', NULL, 'سایر فروش', 'revenue', 153),
      ('trading', 'detail', '6203', 'C6_62', NULL, 'سایر درآمدهای عملیاتی', 'revenue', 154),
      ('trading', 'group', 'G7', NULL, 'Expenses', 'هزینه‌ها', 'expense', 155),
      ('trading', 'control', 'C7_71', 'G7', NULL, 'هزینه‌ی حقوق و دستمزد', 'expense', 156),
      ('trading', 'detail', '7101', 'C7_71', NULL, 'حقوق پایه', 'expense', 157),
      ('trading', 'detail', '7102', 'C7_71', NULL, 'اضافه‌کاری', 'expense', 158),
      ('trading', 'detail', '7103', 'C7_71', NULL, 'خواربار و مسکن', 'expense', 159),
      ('trading', 'detail', '7104', 'C7_71', NULL, 'حق اولاد', 'expense', 160),
      ('trading', 'detail', '7105', 'C7_71', NULL, 'کمک‌هزینه‌ی اقلام مصرفی خانوار', 'expense', 161),
      ('trading', 'detail', '7106', 'C7_71', NULL, 'نوبت کاری و شب‌کاری', 'expense', 162),
      ('trading', 'detail', '7107', 'C7_71', NULL, '%23 حق بیمه‌ی سهم کارفرما', 'expense', 163),
      ('trading', 'detail', '7108', 'C7_71', NULL, 'عیدی و پاداش', 'expense', 164),
      ('trading', 'detail', '7109', 'C7_71', NULL, 'حق‌الجذب', 'expense', 165),
      ('trading', 'detail', '7110', 'C7_71', NULL, 'بازخرید مرخصی استفاده‌نشده', 'expense', 166),
      ('trading', 'detail', '7111', 'C7_71', NULL, 'مزایای پایان‌خدمت کارکنان', 'expense', 167),
      ('trading', 'detail', '7112', 'C7_71', NULL, 'کمک‌های غیرنقدی', 'expense', 168),
      ('trading', 'control', 'C7_72', 'G7', NULL, 'هزینه‌های عملیاتی', 'expense', 169),
      ('trading', 'detail', '7202', 'C7_72', NULL, 'تعمیر و نگهداری ساختمان و تاسیسات', 'expense', 170),
      ('trading', 'detail', '7203', 'C7_72', NULL, 'تعمیر و نگهداری ماشین‌آلات و تجهیزات', 'expense', 171),
      ('trading', 'detail', '7204', 'C7_72', NULL, 'تعمیر و نگهداری وسائط نقلیه', 'expense', 172),
      ('trading', 'detail', '7205', 'C7_72', NULL, 'تعمیر و نگهداری اثاثیه و منصوبات', 'expense', 173),
      ('trading', 'detail', '7206', 'C7_72', NULL, 'سوخت و انرژی', 'expense', 174),
      ('trading', 'detail', '7207', 'C7_72', NULL, 'آب، برق، گاز و تلفن', 'expense', 175),
      ('trading', 'detail', '7208', 'C7_72', NULL, 'ملزومات، نوشت‌افزار و آگهی', 'expense', 176),
      ('trading', 'detail', '7209', 'C7_72', NULL, 'آبدارخانه', 'expense', 177),
      ('trading', 'detail', '7210', 'C7_72', NULL, 'حمل‌ونقل', 'expense', 178),
      ('trading', 'detail', '7211', 'C7_72', NULL, 'اجاره‌ی مکان', 'expense', 179),
      ('trading', 'detail', '7212', 'C7_72', NULL, 'بیمه‌ی دارایی‌ها', 'expense', 180),
      ('trading', 'detail', '7213', 'C7_72', NULL, 'استهلاک دارایی‌ها', 'expense', 181),
      ('trading', 'detail', '7214', 'C7_72', NULL, 'ملزومات مصرفی', 'expense', 182),
      ('trading', 'detail', '7215', 'C7_72', NULL, 'ایاب‌و‌ذهاب', 'expense', 183),
      ('trading', 'detail', '7216', 'C7_72', NULL, 'هزینه‌ی غذای کارکنان', 'expense', 184),
      ('trading', 'detail', '7217', 'C7_72', NULL, 'هزینه‌ی پیک و پست', 'expense', 185),
      ('trading', 'detail', '7218', 'C7_72', NULL, 'پوشاک کارکنان', 'expense', 186),
      ('trading', 'detail', '7219', 'C7_72', NULL, 'بهداشت و درمان', 'expense', 187),
      ('trading', 'detail', '7220', 'C7_72', NULL, 'هزینه‌ی سفر و ماموریت', 'expense', 188),
      ('trading', 'detail', '7221', 'C7_72', NULL, 'کارمزدهای بانکی', 'expense', 189),
      ('trading', 'detail', '7222', 'C7_72', NULL, 'هزینه‌های بسته‌بندی', 'expense', 190),
      ('trading', 'detail', '7226', 'C7_72', NULL, 'حق‌المشاوره', 'expense', 191),
      ('trading', 'detail', '7227', 'C7_72', NULL, 'هزینه‌های رایانه‌ای', 'expense', 192),
      ('trading', 'detail', '7228', 'C7_72', NULL, 'هزینه‌ی ثبتی، حق تمبر و وکالت', 'expense', 193),
      ('trading', 'control', 'C7_73', 'G7', NULL, 'هزینه‌های توزیع و فروش', 'expense', 194),
      ('trading', 'detail', '7301', 'C7_73', NULL, 'هزینه‌های تبلیغات، بازاریابی، کاتالوگ و بروشور', 'expense', 195),
      ('trading', 'detail', '7302', 'C7_73', NULL, 'هزینه‌ی انبارداری', 'expense', 196),
      ('trading', 'detail', '7303', 'C7_73', NULL, 'کمیسیون‌های پرداختی', 'expense', 197),
      ('trading', 'detail', '7304', 'C7_73', NULL, 'هزینه‌ی حمل‌ونقل کالای فروش‌رفته', 'expense', 198),
      ('trading', 'detail', '7305', 'C7_73', NULL, 'هزینه‌ی مطالبات مشکوک‌الوصول و سوخت‌شده', 'expense', 199),
      ('trading', 'detail', '7306', 'C7_73', NULL, 'پاداش هیئت‌مدیره', 'expense', 200),
      ('trading', 'control', 'C7_74', 'G7', NULL, 'سایر اقلام عملیاتی', 'expense', 201),
      ('trading', 'detail', '7401', 'C7_74', NULL, 'فروش کالای ضایعاتی', 'expense', 202),
      ('trading', 'detail', '7402', 'C7_74', NULL, 'سود و زیان ناشی از تسعیر دارایی‌ها و بدهی‌های ارزی عملیاتی', 'expense', 203),
      ('trading', 'detail', '7403', 'C7_74', NULL, 'درآمد اجاره', 'expense', 204),
      ('trading', 'detail', '7404', 'C7_74', NULL, 'زیان کاهش ارزش موجودی‌ها', 'expense', 205),
      ('trading', 'detail', '7405', 'C7_74', NULL, 'خالص کسری و اضافی انبارها', 'expense', 206),
      ('trading', 'control', 'C7_75', 'G7', NULL, 'هزینه‌های مالی', 'expense', 207),
      ('trading', 'detail', '7501', 'C7_75', NULL, 'سود تضمین‌شده و کارمزد تسهیلات دریافتی', 'expense', 208),
      ('trading', 'detail', '7502', 'C7_75', NULL, 'هزینه‌ی خرید سفته', 'expense', 209),
      ('trading', 'detail', '7503', 'C7_75', NULL, 'هزینه‌ی خدمات حسابداری و حسابرسی', 'expense', 210),
      ('trading', 'detail', '7504', 'C7_75', NULL, 'کارمزد صدور ضمانت‌نامه‌های بانکی', 'expense', 211),
      ('trading', 'detail', '7505', 'C7_75', NULL, 'هزینه‌ی رهن املاک', 'expense', 212),
      ('trading', 'control', 'C7_76', 'G7', NULL, 'سایر درآمدها و هزینه‌های غیرعملیاتی', 'expense', 213),
      ('trading', 'detail', '7601', 'C7_76', NULL, 'سود و زیان ناشی از فروش دارایی‌های ثابت مشهود و نامشهود', 'expense', 214),
      ('trading', 'detail', '7602', 'C7_76', NULL, 'سود سپرده‌های بانکی و سایر اوراق بهادار', 'expense', 215),
      ('trading', 'detail', '7604', 'C7_76', NULL, 'سود سهام', 'expense', 216),
      ('trading', 'detail', '7605', 'C7_76', NULL, 'زیان کاهش ارزش سرمایه‌گذاری‌های بلندمدت', 'expense', 217),
      ('trading', 'detail', '7606', 'C7_76', NULL, 'سود ناشی از فروش سرمایه‌گذاری‌ها', 'expense', 218),
      ('trading', 'detail', '7607', 'C7_76', NULL, 'درآمد و هزینه‌ی ناشی از ارزیابی سرمایه‌گذاری‌های جاری سریع‌المعامله به ارزش بازار', 'expense', 219),
      ('trading', 'detail', '7608', 'C7_76', NULL, 'سود و زیان تسعیر دارایی‌ها و بدهی‌های ارزی غیرمرتبط با عملیات', 'expense', 220),
      ('trading', 'group', 'G9', NULL, 'Memo Accounts', 'حساب‌های انتظامی', 'memo', 221),
      ('trading', 'control', 'C9_91', 'G9', NULL, 'حساب‌های انتظامی', 'memo', 222),
      ('trading', 'detail', '9101', 'C9_91', NULL, 'اسناد تضمینی ما نزد دیگران', 'memo', 223),
      ('trading', 'detail', '9102', 'C9_91', NULL, 'سفته‌های تضمینی ما نزد دیگران', 'memo', 224),
      ('trading', 'detail', '9103', 'C9_91', NULL, 'ضمانت‌نامه‌های بانکی ما نزد دیگران', 'memo', 225),
      ('trading', 'detail', '9104', 'C9_91', NULL, 'اسناد تضمینی دیگران نزد ما', 'memo', 226),
      ('trading', 'control', 'C9_92', 'G9', NULL, 'طرف حساب‌های انتظامی', 'memo', 227),
      ('trading', 'detail', '9201', 'C9_92', NULL, 'طرف اسناد تضمینی ما نزد دیگران', 'memo', 228),
      ('trading', 'detail', '9202', 'C9_92', NULL, 'طرف سفته‌های تضمینی ما نزد دیگران', 'memo', 229),
      ('trading', 'detail', '9203', 'C9_92', NULL, 'طرف ضمانت‌نامه‌های بانکی ما نزد دیگران', 'memo', 230),
      ('trading', 'detail', '9204', 'C9_92', NULL, 'طرف اسناد تضمینی دیگران نزد ما', 'memo', 231)
    ON CONFLICT (template_key, code) DO NOTHING;
  `)

  await pgQuery(`
    SELECT 1;
  `)
}
