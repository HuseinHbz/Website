/**
 * Global Search — server data layer (Module 13).
 *
 * A fixed registry of searchable sources across every operational module. Each
 * source is a parametrised ILIKE query (the query pattern is the ONLY parameter —
 * no arbitrary SQL, no injection surface) that returns candidate rows; the pure
 * ranking engine scores + orders them. Runs all sources concurrently and groups
 * the ranked hits by module for the admin Global Search page.
 */
import { pgQuery } from '@/lib/db'
import { rankHits, groupByModule, type SearchCandidate, type SearchHit } from './engine'

export interface SearchSource {
  module: string
  /** SQL returning at least: id, title. Optional: subtitle, keywords. `$1` = %pattern%. */
  sql: string
  type: string
  url: (id: number | string) => string
}

const s = (v: unknown) => (v == null ? undefined : String(v))

export const SOURCES: SearchSource[] = [
  {
    module: 'crm', type: 'lead', url: () => '/admin/crm',
    sql: `SELECT id, name AS title, company AS subtitle, coalesce(email,'')||' '||coalesce(phone,'') AS keywords
          FROM crm_leads WHERE name ILIKE $1 OR company ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 LIMIT 25`,
  },
  {
    module: 'sales', type: 'customer', url: () => '/admin/sales',
    sql: `SELECT id, name AS title, company AS subtitle, coalesce(code,'')||' '||coalesce(email,'') AS keywords
          FROM sales_customers WHERE name ILIKE $1 OR code ILIKE $1 OR email ILIKE $1 OR company ILIKE $1 LIMIT 25`,
  },
  {
    module: 'sales', type: 'document', url: () => '/admin/sales',
    sql: `SELECT d.id, d.doc_no AS title, c.name AS subtitle, d.doc_type AS keywords
          FROM sales_documents d LEFT JOIN sales_customers c ON c.id=d.customer_id
          WHERE d.doc_no ILIKE $1 LIMIT 25`,
  },
  {
    module: 'finance', type: 'account', url: () => '/admin/finance',
    sql: `SELECT id, name_en AS title, code AS subtitle, coalesce(name_fa,'')||' '||type AS keywords
          FROM gl_accounts WHERE name_en ILIKE $1 OR name_fa ILIKE $1 OR code ILIKE $1 LIMIT 25`,
  },
  {
    module: 'finance', type: 'journal', url: () => '/admin/finance',
    sql: `SELECT id, entry_no AS title, memo AS subtitle, coalesce(reference,'') AS keywords
          FROM gl_journal_entries WHERE entry_no ILIKE $1 OR memo ILIKE $1 OR reference ILIKE $1 LIMIT 25`,
  },
  {
    module: 'inventory', type: 'product', url: () => '/admin/inventory',
    sql: `SELECT id, name_en AS title, sku AS subtitle, coalesce(name_fa,'')||' '||coalesce(barcode,'')||' '||category AS keywords
          FROM inv_products WHERE name_en ILIKE $1 OR name_fa ILIKE $1 OR sku ILIKE $1 OR barcode ILIKE $1 LIMIT 25`,
  },
  {
    module: 'assets', type: 'asset', url: () => '/admin/assets',
    sql: `SELECT id, name AS title, type AS subtitle, coalesce(serial,'')||' '||coalesce(location,'') AS keywords
          FROM assets WHERE name ILIKE $1 OR serial ILIKE $1 OR location ILIKE $1 LIMIT 25`,
  },
  {
    module: 'projects', type: 'project', url: () => '/admin/project-management',
    sql: `SELECT id, name AS title, code AS subtitle, coalesce(customer,'')||' '||coalesce(manager,'') AS keywords
          FROM pm_projects WHERE name ILIKE $1 OR code ILIKE $1 OR customer ILIKE $1 LIMIT 25`,
  },
  {
    module: 'projects', type: 'task', url: () => '/admin/project-management',
    sql: `SELECT id, title, description AS subtitle, coalesce(assignee,'') AS keywords
          FROM pm_tasks WHERE title ILIKE $1 OR description ILIKE $1 OR assignee ILIKE $1 LIMIT 25`,
  },
  {
    module: 'documents', type: 'document', url: () => '/admin/documents',
    sql: `SELECT id, coalesce(title, number) AS title, number AS subtitle, coalesce(party_name,'')||' '||type AS keywords
          FROM gen_documents WHERE number ILIKE $1 OR title ILIKE $1 OR party_name ILIKE $1 LIMIT 25`,
  },
  {
    module: 'workflows', type: 'workflow', url: () => '/admin/workflows',
    sql: `SELECT id, name_en AS title, description AS subtitle, coalesce(key,'')||' '||coalesce(name_fa,'') AS keywords
          FROM workflows WHERE name_en ILIKE $1 OR name_fa ILIKE $1 OR key ILIKE $1 OR description ILIKE $1 LIMIT 25`,
  },
  {
    module: 'rules', type: 'rule', url: () => '/admin/rules',
    sql: `SELECT id, name_en AS title, category AS subtitle, coalesce(key,'')||' '||coalesce(name_fa,'') AS keywords
          FROM business_rules WHERE name_en ILIKE $1 OR name_fa ILIKE $1 OR key ILIKE $1 OR category ILIKE $1 LIMIT 25`,
  },
  {
    module: 'integrations', type: 'integration', url: () => '/admin/integration-hub',
    sql: `SELECT id, name AS title, type AS subtitle, coalesce(key,'') AS keywords
          FROM integrations WHERE name ILIKE $1 OR key ILIKE $1 OR type ILIKE $1 LIMIT 25`,
  },
]

export const SEARCH_MODULES = [...new Set(SOURCES.map(x => x.module))]

interface RawRow { id: number | string; title: string | null; subtitle?: string | null; keywords?: string | null }

/**
 * Search across all (or a filtered set of) modules. Returns ranked hits grouped
 * by module plus a flat, globally-ranked list and a total count.
 */
export async function globalSearch(
  query: string,
  opts: { modules?: string[]; limit?: number } = {},
): Promise<{ groups: { module: string; hits: SearchHit[] }[]; hits: SearchHit[]; total: number }> {
  const q = query.trim()
  if (q.length < 2) return { groups: [], hits: [], total: 0 }
  const pattern = `%${q}%`
  const active = opts.modules?.length
    ? SOURCES.filter(x => opts.modules!.includes(x.module))
    : SOURCES

  const candidates: SearchCandidate[] = []
  await Promise.all(active.map(async src => {
    try {
      const rows = (await pgQuery(src.sql, [pattern])) as unknown as RawRow[]
      for (const r of rows) {
        if (!r.title) continue
        candidates.push({
          module: src.module, type: src.type, id: r.id,
          title: r.title, subtitle: s(r.subtitle), keywords: s(r.keywords),
          url: src.url(r.id),
        })
      }
    } catch { /* a missing table (fresh env) must never break global search */ }
  }))

  const hits = rankHits(candidates, q, opts.limit ?? 60)
  return { groups: groupByModule(hits), hits, total: hits.length }
}
