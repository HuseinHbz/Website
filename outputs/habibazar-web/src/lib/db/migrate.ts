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

    -- Enterprise Integration Hub (Phase 21.8). Connectors + a dispatch log that
    -- doubles as the dead-letter queue (status 'dead' after retries exhausted).
    CREATE TABLE IF NOT EXISTS integrations (
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
      connector_id INTEGER NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
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
      ('doc_financial_report','Document · Financial Report','سند · گزارش مالی','{PREFIX}-{YEAR}-{COUNTER}','FR','yearly',6,1)
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

    -- Enterprise Financial System (Phase 21 ERP, Module 1) — double-entry GL.
    CREATE TABLE IF NOT EXISTS gl_fiscal_periods (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
      created_at TEXT NOT NULL DEFAULT (${NOW})
    );

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
  `)
}
