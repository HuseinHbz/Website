/**
 * Hero Platform — server data layer (Phase 23).
 *
 * PostgreSQL access (via pgQuery) shared by the admin APIs and the public
 * resolver. Keeps SQL in one place; the pure engines do all the logic.
 */
import { pgQuery } from '@/lib/db'
import type { HeroConfig, HeroRecord, HeroStatus } from './types'
import { resolveHero, type PersonalizationRule, type RequestContext } from './personalize'
import { pickVariant, type Experiment } from './experiment'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

interface HeroRow {
  id: number; slug: string; name: string; template: string; category: string | null
  tags: string; status: string; config: string; version: number; target_path: string | null; updated_at: string
}
const parseJson = <T,>(s: string | null | undefined, fallback: T): T => { try { return s ? JSON.parse(s) as T : fallback } catch { return fallback } }

export function rowToHero(r: HeroRow): HeroRecord {
  return {
    id: r.id, slug: r.slug, name: r.name, template: r.template, category: r.category,
    tags: parseJson<string[]>(r.tags, []), status: r.status as HeroStatus,
    config: parseJson<HeroConfig>(r.config, { template: r.template, content: { en: {}, fa: {} }, style: {} }),
    version: r.version, targetPath: r.target_path, updatedAt: r.updated_at,
  }
}

export async function listHeroes(): Promise<HeroRecord[]> {
  const rows = await pgQuery<HeroRow>(`SELECT id, slug, name, template, category, tags, status, config, version, target_path, updated_at FROM heroes ORDER BY updated_at DESC`)
  return rows.map(rowToHero)
}
export async function getHero(id: number): Promise<HeroRecord | null> {
  const r = (await pgQuery<HeroRow>(`SELECT id, slug, name, template, category, tags, status, config, version, target_path, updated_at FROM heroes WHERE id=$1`, [id]))[0]
  return r ? rowToHero(r) : null
}

/** Snapshot the current hero into hero_versions (for rollback/compare/audit). */
export async function snapshotVersion(id: number, note: string, authorId?: string) {
  const r = (await pgQuery<HeroRow & { status: string }>(`SELECT version, config, status FROM heroes WHERE id=$1`, [id]))[0]
  if (!r) return
  await pgQuery(
    `INSERT INTO hero_versions (hero_id, version, config, status, note, author_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,${NOW})`,
    [id, r.version, r.config, r.status, note, authorId ?? null])
}

/**
 * Resolve the hero to render for a target path: personalization rules first,
 * then A/B experiment (if any), else the published default for that path.
 */
export async function resolveActiveHero(targetPath: string, ctx: RequestContext, subjectId: string): Promise<{ hero: HeroRecord; experimentKey?: string; variantId?: string } | null> {
  // Published heroes for this path.
  const published = (await pgQuery<HeroRow>(
    `SELECT id, slug, name, template, category, tags, status, config, version, target_path, updated_at
     FROM heroes WHERE status='published' AND (target_path=$1 OR target_path IS NULL) ORDER BY (target_path=$1) DESC, updated_at DESC`, [targetPath]))
    .map(rowToHero)
  if (published.length === 0) return null
  const defaultHero = published.find(h => h.targetPath === targetPath) ?? published[0]

  // A/B experiment (running) for this path takes precedence.
  const expRow = (await pgQuery<{ id: number; key: string; status: string; variants: string }>(
    `SELECT id, key, status, variants FROM hero_experiments WHERE status='running' AND (target_path=$1 OR target_path IS NULL) ORDER BY (target_path=$1) DESC LIMIT 1`, [targetPath]))[0]
  if (expRow) {
    const exp: Experiment = { id: expRow.id, key: expRow.key, status: 'running', variants: parseJson(expRow.variants, []) }
    const v = pickVariant(exp, subjectId)
    const hero = v && published.find(h => h.id === v.heroId)
    if (hero) return { hero, experimentKey: exp.key, variantId: v!.id }
  }

  // Personalization rules.
  const ruleRows = await pgQuery<{ hero_id: number; priority: number; match: string }>(
    `SELECT hero_id, priority, match FROM hero_rules WHERE active=true AND (target_path=$1 OR target_path IS NULL) ORDER BY priority DESC`, [targetPath])
  const rules: PersonalizationRule[] = ruleRows.map(r => ({ heroId: r.hero_id, priority: r.priority, match: parseJson(r.match, {}) }))
  const chosenId = resolveHero(rules, ctx, defaultHero.id)
  const hero = published.find(h => h.id === chosenId) ?? defaultHero
  return { hero }
}
