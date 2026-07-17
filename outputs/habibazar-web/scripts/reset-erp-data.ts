/**
 * Reset ERP transactional + master data (customer request).
 *
 * Wipes everything you ENTERED into the ERP — sales/purchase invoices, customers,
 * suppliers, inventory, GL entries, treasury, CRM, projects, assets, generated
 * documents, budgets, imports — and resets the numbering counters so document
 * numbers start from 1 again. Then you can re-enter customers, invoices, etc.
 *
 * KEPT (seeded config, so the system stays ready to use):
 *   gl_accounts (chart of accounts), erp_currencies, erp_settings (incl. gl_map +
 *   integration keys), erp_companies, tax_profiles, doc_templates,
 *   numbering_formats, numbering_scopes. CMS content (blog/projects/services…),
 *   admin users, and platform config (dashboards, workflows, rules, hero, AI) are
 *   NOT touched.
 *
 * SAFETY:
 *   • DRY-RUN by default — prints per-table row counts and changes NOTHING.
 *   • Real wipe needs BOTH `--apply` AND `--confirm`.
 *   • Refuses to write without a successful backup in the last 24h unless
 *     `--i-have-a-backup` is passed. THIS IS IRREVERSIBLE without a backup.
 *   • Runs inside one transaction; writes a `logAction` audit record.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx scripts/reset-erp-data.ts                       # preview
 *   DATABASE_URL=… npx tsx scripts/reset-erp-data.ts --apply --confirm     # wipe
 */
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'

const APPLY = process.argv.includes('--apply')
const CONFIRM = process.argv.includes('--confirm')
const HAVE_BACKUP = process.argv.includes('--i-have-a-backup')

// Tables holding data YOU entered. Grouped for a readable preview. Order does not
// matter — the wipe uses one TRUNCATE … CASCADE so foreign keys resolve themselves.
const GROUPS: Record<string, string[]> = {
  Sales: ['sales_customers', 'sales_documents', 'sales_document_lines', 'sales_payments', 'sales_targets', 'price_lists', 'price_list_items'],
  Purchasing: ['purchase_vendors', 'purchase_documents', 'purchase_document_lines', 'purchase_approvals', 'purchase_payments', 'vendor_evaluations', 'vendor_contracts', 'vendor_portal_tokens'],
  Inventory: ['inv_products', 'inv_warehouses', 'inv_locations', 'inv_moves', 'inv_serials', 'inv_batches', 'inv_reservations', 'inv_counts', 'inv_count_lines', 'inv_shipments', 'inv_shipment_lines', 'inv_product_suppliers'],
  'GL / Finance': ['gl_journal_entries', 'gl_journal_lines', 'gl_entry_templates', 'erp_exchange_rates', 'erp_budgets', 'erp_budget_lines', 'erp_budget_versions', 'erp_cost_centers', 'erp_cost_center_members', 'erp_forecasts', 'erp_kpi_snapshots', 'erp_financial_alerts', 'erp_categories'],
  Treasury: ['bank_accounts', 'bank_statements', 'bank_statement_lines', 'bank_matches', 'cheques', 'petty_cash_entries', 'payment_orders', 'receipt_transactions', 'cash_positions', 'treasury_forecasts', 'currency_exposures', 'payment_transactions'],
  Documents: ['gen_documents', 'moadian_queue'],
  CRM: ['crm_leads', 'crm_activities', 'crm_customer_channels', 'crm_tickets', 'crm_ticket_messages', 'crm_inbound_messages', 'crm_campaigns', 'crm_campaign_recipients', 'crm_optouts', 'customer_portal_sessions'],
  Projects: ['pm_projects', 'pm_tasks', 'pm_milestones', 'pm_timesheets', 'pm_cost_entries'],
  Assets: ['assets', 'asset_assignments', 'asset_maintenance', 'asset_activity'],
  Approvals: ['approval_requests', 'approval_actions'],
  'Master data / Import': ['master_data_history', 'master_data_issues', 'import_jobs', 'import_job_rows', 'import_mappings', 'import_validation_errors', 'import_history', 'migration_transactions'],
  Derived: ['business_alerts', 'data_quality_checks', 'selfheal_runs', 'selfheal_findings'],
  'Numbering counters (reset to 1)': ['numbering_counters', 'numbering_audit'],
}
const ALL = Object.values(GROUPS).flat()

async function tableExists(t: string): Promise<boolean> {
  const r = await pgQuery<{ e: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS e`, [t])
  return !!r[0]?.e
}
async function count(t: string): Promise<number> {
  const r = await pgQuery<{ c: number }>(`SELECT COUNT(*)::int AS c FROM ${t}`).catch(() => [{ c: 0 }])
  return Number(r[0]?.c ?? 0)
}
async function backupIsFresh(): Promise<boolean> {
  const r = await pgQuery<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM backups WHERE status='success' AND created_at >= to_char(now() - interval '24 hours','YYYY-MM-DD HH24:MI:SS')`,
  ).catch(() => [{ c: 0 }])
  return Number(r[0]?.c ?? 0) > 0
}

async function main() {
  console.log('\n══ Reset ERP data ══')
  console.log(`  mode: ${APPLY ? 'APPLY (deletes data)' : 'DRY-RUN (no changes)'}\n`)

  const present: string[] = []
  let total = 0
  for (const [group, tables] of Object.entries(GROUPS)) {
    let printedGroup = false
    for (const t of tables) {
      if (!(await tableExists(t))) continue
      present.push(t)
      const c = await count(t)
      total += c
      if (c > 0) {
        if (!printedGroup) { console.log(`  ${group}`); printedGroup = true }
        console.log(`    ${t.padEnd(28)} ${c.toLocaleString('en-US')} rows`)
      }
    }
  }
  console.log(`\n  Total rows to delete: ${total.toLocaleString('en-US')} across ${present.length} tables.`)
  console.log('  KEPT: chart of accounts, currencies, tax profiles, numbering formats,')
  console.log('        companies, doc templates, ERP settings, CMS content, users.\n')

  if (!APPLY) {
    console.log('  DRY-RUN — nothing changed. To actually wipe:')
    console.log('    npx tsx scripts/reset-erp-data.ts --apply --confirm --i-have-a-backup\n')
    process.exit(0)
  }
  if (!CONFIRM) { console.error('  ✗ --apply requires --confirm. Aborted (no changes).'); process.exit(2) }
  if (!HAVE_BACKUP && !(await backupIsFresh())) {
    console.error('\n  ✗ No successful backup in the last 24h and --i-have-a-backup not passed.')
    console.error('    This is IRREVERSIBLE. Take a backup first (deploy/backup.sh), then re-run. Aborted.')
    process.exit(3)
  }

  // One atomic TRUNCATE … RESTART IDENTITY CASCADE over the present tables. CASCADE
  // only affects tables that reference this set (all transactional) — the kept
  // config/seed tables reference nothing here, so they are untouched.
  await pgQuery('BEGIN')
  try {
    await pgQuery(`TRUNCATE ${present.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
    await logAction(null, 'erp.data.reset', 'erp', '', { tables: present.length, rows: total })
    await pgQuery('COMMIT')
  } catch (e) { await pgQuery('ROLLBACK'); throw e }

  let remaining = 0
  for (const t of present) remaining += await count(t)
  console.log(`  ✔ Wiped ${present.length} tables · ${total.toLocaleString('en-US')} rows deleted · remaining: ${remaining}`)
  console.log('  ✔ Numbering counters reset — document numbers start from 1 again.')
  console.log('  You can now re-enter customers, suppliers, products and invoices.\n')
}

main().catch(e => { console.error(e); process.exit(1) })
