/**
 * Chart-of-Accounts Import data layer (Phase 18). The DB-touching half of
 * `coaImport.ts`'s pure engine: lists the 3 seeded statutory templates,
 * previews what importing one would create/skip against the LIVE
 * gl_accounts, and applies it transactionally — additive-only (an existing
 * code is always skipped, never overwritten; two different accounts never
 * silently merge).
 */
import { pgQuery, withTransaction, type TxQuery } from '@/lib/db'
import { orderForImport, diffAgainstLive, summarizePlan, type CoaTemplateNode, type CoaPlanNode, type CoaImportSummary } from './coaImport'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

export async function listCoaTemplates() {
  return pgQuery<{ key: string; nameEn: string; nameFa: string }>(
    `SELECT key, name_en AS "nameEn", name_fa AS "nameFa" FROM coa_import_templates ORDER BY key`)
}

async function loadTemplateNodes(templateKey: string): Promise<CoaTemplateNode[]> {
  const rows = await pgQuery<{ level: string; code: string; parent_code: string | null; name_en: string | null; name_fa: string; account_type: string; sort_order: number }>(
    `SELECT level, code, parent_code, name_en, name_fa, account_type, sort_order
     FROM coa_import_nodes WHERE template_key=$1 ORDER BY sort_order`, [templateKey])
  if (rows.length === 0) throw new Error(`Unknown chart-of-accounts template: ${templateKey}`)
  return rows.map(r => ({
    level: r.level as CoaTemplateNode['level'], code: r.code, parentCode: r.parent_code,
    nameEn: r.name_en, nameFa: r.name_fa, accountType: r.account_type, sortOrder: r.sort_order,
  }))
}

/** Diffs a template against the LIVE chart — pure decision, live data. */
export async function previewCoaImport(templateKey: string): Promise<{ plan: CoaPlanNode[]; summary: CoaImportSummary }> {
  const nodes = await loadTemplateNodes(templateKey)
  const liveCodes = new Set((await pgQuery<{ code: string }>(`SELECT code FROM gl_accounts`)).map(r => r.code))
  const plan = diffAgainstLive(nodes, liveCodes)
  return { plan, summary: summarizePlan(plan) }
}

/**
 * Applies a template: creates every NOT-yet-existing node (group → control
 * → detail, so parent_id always resolves to an already-committed row) as a
 * real `gl_accounts` row, wiring `parent_id` via the just-created/already-
 * existing parent's id. Existing codes are skipped — an operator who has
 * already imported (or manually created) an account under this code keeps
 * it untouched; this never merges or renames a live account. Whole
 * operation is one transaction: a failure partway through leaves nothing
 * behind.
 */
export async function applyCoaImport(templateKey: string, userId?: string): Promise<{ created: number; skipped: number; createdCodes: string[] }> {
  const nodes = orderForImport(await loadTemplateNodes(templateKey))
  return withTransaction(async (query: TxQuery) => {
    // Serializes concurrent imports (of the same or a different template) so
    // two operators clicking "Import" at once can never both race past the
    // same not-yet-existing code's conflict check.
    await query(`SELECT pg_advisory_xact_lock(hashtextextended('coa_import', 0))`)
    const idByCode = new Map<string, number>()
    const existing = await query<{ id: number; code: string }>(`SELECT id, code FROM gl_accounts`)
    for (const r of existing) idByCode.set(r.code, r.id)

    let created = 0
    let skipped = 0
    const createdCodes: string[] = []
    for (const n of nodes) {
      if (idByCode.has(n.code)) { skipped++; continue }
      const parentId = n.parentCode ? idByCode.get(n.parentCode) ?? null : null
      // gl_accounts.name_en is NOT NULL; the source workbook is Persian-only
      // for control/detail rows (no English label exists), so it falls back
      // to the Persian name rather than fabricating a translation.
      const row = (await query<{ id: number }>(
        `INSERT INTO gl_accounts (code, name_en, name_fa, type, parent_id, active, created_at)
         VALUES ($1,$2,$3,$4,$5,1,${NOW}) RETURNING id`,
        [n.code, n.nameEn ?? n.nameFa, n.nameFa, n.accountType, parentId]))[0]
      idByCode.set(n.code, row.id)
      created++
      createdCodes.push(n.code)
    }
    return { created, skipped, createdCodes }
  })
}
