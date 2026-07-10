/**
 * CMS → AI Knowledge synchronization.
 *
 * Keeps `ai_knowledge_base` in sync with published CMS content (blog, projects,
 * solutions, technologies, professional journey) so RAG always retrieves current
 * material — no manual re-entry. Each synced row is keyed by a stable
 * `source_url` = `cms://<type>/<id>`, which makes the sync idempotent, enables
 * orphan cleanup when content is deleted/unpublished, and doubles as duplicate
 * detection. Triggered (debounced) from `audit.logAction` on content mutations
 * and via `POST /api/admin/ai-kb/sync`.
 *
 * Runs on raw parameterized SQL with defensive column access so it tolerates schema
 * drift and never throws into a caller. The row→entry mapping is a pure function
 * (`buildEntry`) for unit testing.
 */
import { pgQuery } from '@/lib/db'
import { backfillKbEmbeddings } from './embeddings'
import { logBus } from '@/lib/logs/bus'

export interface KbEntry { sourceUrl: string; title: string; content: string; tags: string }

export interface Source { type: string; table: string; where: string; titleCols: string[]; bodyCols: string[] }

// Content sources → which columns form the title and the body. Only published /
// active rows are synced. English + Persian text are both included for retrieval.
const SOURCES: Source[] = [
  { type: 'blog', table: 'blog_posts', where: "status = 'published'", titleCols: ['title_en', 'title_fa'], bodyCols: ['excerpt_en', 'excerpt_fa', 'content_en'] },
  { type: 'project', table: 'projects', where: 'active = true', titleCols: ['name_en', 'name_fa'], bodyCols: ['industry_en', 'client_en', 'challenge_en', 'solution_en', 'results_en'] },
  { type: 'solution', table: 'solutions', where: 'active = true', titleCols: ['name_en', 'name_fa'], bodyCols: ['tagline_en', 'description_en', 'description_fa'] },
  { type: 'technology', table: 'technologies', where: 'active = true', titleCols: ['name_en', 'name_fa'], bodyCols: ['vendor', 'category', 'description_en', 'description_fa'] },
  { type: 'journey', table: 'timeline_items', where: 'active = true', titleCols: ['title_en', 'title_fa'], bodyCols: ['company_en', 'desc_en', 'desc_fa', 'year'] },
]

const CMS_PREFIX = 'cms://'

function firstNonEmpty(row: Record<string, unknown>, cols: string[]): string {
  for (const c of cols) { const v = row[c]; if (typeof v === 'string' && v.trim()) return v.trim() }
  return ''
}
function strip(s: string): string {
  // Remove HTML tags + collapse whitespace, cap length so one row can't dominate.
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
}

/** Pure row → KB entry mapping (unit-tested). Returns null if there's no title. */
export function buildEntry(source: Source, row: Record<string, unknown>): KbEntry | null {
  const id = row.id
  if (id == null) return null
  const title = firstNonEmpty(row, source.titleCols)
  if (!title) return null
  const body = source.bodyCols.map((c) => (typeof row[c] === 'string' ? row[c] as string : '')).filter(Boolean).join('. ')
  const content = strip([title, body].filter(Boolean).join('. '))
  return { sourceUrl: `${CMS_PREFIX}${source.type}/${id}`, title: strip(title).slice(0, 300), content, tags: `cms,${source.type}` }
}

export interface SyncResult { created: number; updated: number; removed: number; total: number; errors: string[] }

/** Idempotent full sync of CMS content into the knowledge base. */
export async function syncKnowledgeFromCms(userId?: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, removed: 0, total: 0, errors: [] }

  const liveKeys = new Set<string>()
  for (const source of SOURCES) {
    try {
      const rows = await pgQuery(`SELECT * FROM ${source.table} WHERE ${source.where}`) as Record<string, unknown>[]
      for (const row of rows) {
        const entry = buildEntry(source, row)
        if (!entry) continue
        liveKeys.add(entry.sourceUrl)
        const existing = (await pgQuery(`SELECT id FROM ai_knowledge_base WHERE source_url = $1`, [entry.sourceUrl]))[0] as { id: number } | undefined
        if (existing) {
          await pgQuery(
            `UPDATE ai_knowledge_base SET title=$1, content=$2, tags=$3, active=true, updated_at=to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), updated_by=$4 WHERE source_url=$5`,
            [entry.title, entry.content, entry.tags, userId ?? null, entry.sourceUrl],
          )
          result.updated++
        } else {
          await pgQuery(
            `INSERT INTO ai_knowledge_base (title, type, content, source_url, tags, locale, active, priority, updated_by)
             VALUES ($1, 'document', $2, $3, $4, 'both', true, 1, $5)`,
            [entry.title, entry.content, entry.sourceUrl, entry.tags, userId ?? null],
          )
          result.created++
        }
      }
    } catch (e) {
      result.errors.push(`${source.table}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Orphan cleanup: remove cms:// rows whose source no longer exists/published.
  try {
    const cmsRows = await pgQuery(`SELECT id, source_url FROM ai_knowledge_base WHERE source_url LIKE '${CMS_PREFIX}%'`) as { id: number; source_url: string }[]
    for (const r of cmsRows) if (!liveKeys.has(r.source_url)) { await pgQuery(`DELETE FROM ai_knowledge_base WHERE id = $1`, [r.id]); result.removed++ }
  } catch (e) {
    result.errors.push(`cleanup: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.total = liveKeys.size
  logBus.publish({
    level: result.errors.length ? 'warn' : 'info', source: 'ai', service: 'kb-sync',
    message: `knowledge_sync ${result.created}+ ${result.updated}~ ${result.removed}- (${result.total} live)`,
    meta: { ...result },
  })
  // Semantic layer: best-effort embedding backfill for new/changed entries
  // (no-op when no embeddings-capable provider is configured).
  try { await backfillKbEmbeddings() } catch { /* keyword fallback remains */ }

  return result
}

// CMS resources whose changes should refresh the knowledge base.
const SYNCED_RESOURCES = new Set(['blog_posts', 'projects', 'solutions', 'technologies', 'timeline_items'])
let syncTimer: NodeJS.Timeout | null = null

/**
 * Debounced auto-sync trigger, called from audit.logAction on content mutations.
 * Coalesces bursts of edits into a single sync a few seconds later, off the
 * request path.
 */
export function scheduleKbSync(resource: string) {
  if (!SYNCED_RESOURCES.has(resource)) return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => { syncKnowledgeFromCms().catch(() => { /* logged inside */ }) }, 5000)
  if (syncTimer.unref) syncTimer.unref()
}
