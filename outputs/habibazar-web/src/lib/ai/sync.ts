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
 * Runs on raw better-sqlite3 with defensive column access so it tolerates schema
 * drift and never throws into a caller. The row→entry mapping is a pure function
 * (`buildEntry`) for unit testing.
 */
import type Database from 'better-sqlite3'
import { getDb } from '@/lib/db'
import { logBus } from '@/lib/logs/bus'

export interface KbEntry { sourceUrl: string; title: string; content: string; tags: string }

export interface Source { type: string; table: string; where: string; titleCols: string[]; bodyCols: string[] }

// Content sources → which columns form the title and the body. Only published /
// active rows are synced. English + Persian text are both included for retrieval.
const SOURCES: Source[] = [
  { type: 'blog', table: 'blog_posts', where: "status = 'published'", titleCols: ['title_en', 'title_fa'], bodyCols: ['excerpt_en', 'excerpt_fa', 'content_en'] },
  { type: 'project', table: 'projects', where: 'active = 1', titleCols: ['name_en', 'name_fa'], bodyCols: ['industry_en', 'client_en', 'challenge_en', 'solution_en', 'results_en'] },
  { type: 'solution', table: 'solutions', where: 'active = 1', titleCols: ['name_en', 'name_fa'], bodyCols: ['tagline_en', 'description_en', 'description_fa'] },
  { type: 'technology', table: 'technologies', where: 'active = 1', titleCols: ['name_en', 'name_fa'], bodyCols: ['vendor', 'category', 'description_en', 'description_fa'] },
  { type: 'journey', table: 'timeline_items', where: 'active = 1', titleCols: ['title_en', 'title_fa'], bodyCols: ['company_en', 'desc_en', 'desc_fa', 'year'] },
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

function client(): Database.Database | null {
  try { return (getDb() as unknown as { $client: Database.Database }).$client } catch { return null }
}

export interface SyncResult { created: number; updated: number; removed: number; total: number; errors: string[] }

/** Idempotent full sync of CMS content into the knowledge base. */
export function syncKnowledgeFromCms(userId?: string): SyncResult {
  const db = client()
  const result: SyncResult = { created: 0, updated: 0, removed: 0, total: 0, errors: [] }
  if (!db) { result.errors.push('db unavailable'); return result }

  const findByUrl = db.prepare(`SELECT id FROM ai_knowledge_base WHERE source_url = ?`)
  const insert = db.prepare(
    `INSERT INTO ai_knowledge_base (title, type, content, source_url, tags, locale, active, priority, updated_by)
     VALUES (@title, 'document', @content, @sourceUrl, @tags, 'both', 1, 1, @userId)`
  )
  const update = db.prepare(
    `UPDATE ai_knowledge_base SET title=@title, content=@content, tags=@tags, active=1, updated_at=datetime('now'), updated_by=@userId WHERE source_url=@sourceUrl`
  )

  const liveKeys = new Set<string>()
  for (const source of SOURCES) {
    try {
      const rows = db.prepare(`SELECT * FROM ${source.table} WHERE ${source.where}`).all() as Record<string, unknown>[]
      for (const row of rows) {
        const entry = buildEntry(source, row)
        if (!entry) continue
        liveKeys.add(entry.sourceUrl)
        const existing = findByUrl.get(entry.sourceUrl) as { id: number } | undefined
        if (existing) { update.run({ ...entry, userId: userId ?? null }); result.updated++ }
        else { insert.run({ ...entry, userId: userId ?? null }); result.created++ }
      }
    } catch (e) {
      result.errors.push(`${source.table}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Orphan cleanup: remove cms:// rows whose source no longer exists/published.
  try {
    const cmsRows = db.prepare(`SELECT id, source_url FROM ai_knowledge_base WHERE source_url LIKE '${CMS_PREFIX}%'`).all() as { id: number; source_url: string }[]
    const del = db.prepare(`DELETE FROM ai_knowledge_base WHERE id = ?`)
    for (const r of cmsRows) if (!liveKeys.has(r.source_url)) { del.run(r.id); result.removed++ }
  } catch (e) {
    result.errors.push(`cleanup: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.total = liveKeys.size
  logBus.publish({
    level: result.errors.length ? 'warn' : 'info', source: 'ai', service: 'kb-sync',
    message: `knowledge_sync ${result.created}+ ${result.updated}~ ${result.removed}- (${result.total} live)`,
    meta: { ...result },
  })
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
  syncTimer = setTimeout(() => { try { syncKnowledgeFromCms() } catch { /* logged inside */ } }, 5000)
  if (syncTimer.unref) syncTimer.unref()
}
