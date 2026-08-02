import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import type { AdminUser } from '@/lib/admin/auth'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { listHeroes, getHero, snapshotVersion } from '@/lib/hero/heroData'
import { canPublish, validateHero } from '@/lib/hero/rules'
import { isKnownTemplate, defaultConfig } from '@/lib/hero/templates'
import type { HeroConfig, HeroStatus } from '@/lib/hero/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'hero'

// GET — list heroes (with validation status), or ?id= for one + its versions.
export async function GET(req: NextRequest) {
  const auth = await requirePermission('brand.hero', 'read')
  if ('error' in auth) return auth.error
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (id) {
      const hero = await getHero(Number(id))
      if (!hero) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const versions = await pgQuery(`SELECT id, version, status, note, created_at FROM hero_versions WHERE hero_id=$1 ORDER BY version DESC`, [Number(id)])
      return NextResponse.json({ hero, versions, validation: validateHero(hero.config) })
    }
    const heroes = await listHeroes()
    return NextResponse.json({ heroes: heroes.map(h => ({ ...h, valid: canPublish(h.config) })) })
  } catch (e) { return apiError(e, 'Failed to load heroes') }
}

const configSchema = z.record(z.string(), z.unknown())
const createSchema = z.object({
  action: z.literal('create'),
  name: z.string().min(1).max(120),
  template: z.string().max(60),
  category: z.string().max(40).optional(),
  targetPath: z.string().max(200).optional(),
})
const updateSchema = z.object({
  action: z.literal('update'), id: z.number().int(),
  name: z.string().min(1).max(120).optional(),
  category: z.string().max(40).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  targetPath: z.string().max(200).nullable().optional(),
  config: configSchema.optional(),
})
const lifecycleSchema = z.object({ action: z.enum(['submit', 'approve', 'publish', 'unpublish', 'archive', 'duplicate', 'rollback']), id: z.number().int(), version: z.number().int().optional() })
const bulkSchema = z.object({ action: z.literal('bulk'), op: z.enum(['publish', 'unpublish', 'archive', 'delete', 'duplicate']), ids: z.array(z.number().int()).min(1).max(100) })
const body = z.discriminatedUnion('action', [createSchema, updateSchema, lifecycleSchema, bulkSchema])

const STATUS_FLOW: Record<string, HeroStatus> = { submit: 'review', approve: 'approved', unpublish: 'approved', archive: 'archived' }

export async function POST(req: NextRequest) {
  const auth = await requirePermission('brand.hero', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const uid = auth.user.id
  try {
    if (d.action === 'create') {
      if (!isKnownTemplate(d.template)) return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
      const cfg = defaultConfig(d.template)
      let slug = slugify(d.name); let n = 1
      while ((await pgQuery(`SELECT 1 FROM heroes WHERE slug=$1`, [slug])).length) slug = `${slugify(d.name)}-${++n}`
      const row = (await pgQuery<{ id: number }>(
        `INSERT INTO heroes (slug, name, template, category, target_path, config, author_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,${NOW},${NOW}) RETURNING id`,
        [slug, d.name, d.template, d.category ?? null, d.targetPath ?? null, JSON.stringify(cfg), uid]))[0]
      await logAction(auth.user, 'hero.create', 'heroes', String(row.id), { template: d.template })
      return NextResponse.json({ id: row.id })
    }

    if (d.action === 'update') {
      const cur = await getHero(d.id); if (!cur) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (d.config !== undefined) await snapshotVersion(d.id, 'edit', uid)
      await pgQuery(
        `UPDATE heroes SET name=COALESCE($2,name), category=$3, tags=COALESCE($4,tags), target_path=$5,
           config=COALESCE($6,config), version=CASE WHEN $6 IS NULL THEN version ELSE version+1 END, updated_at=${NOW} WHERE id=$1`,
        [d.id, d.name ?? null, d.category === undefined ? cur.category : d.category, d.tags ? JSON.stringify(d.tags) : null,
         d.targetPath === undefined ? cur.targetPath : d.targetPath, d.config ? JSON.stringify(d.config) : null])
      await logAction(auth.user, 'hero.update', 'heroes', String(d.id), {})
      return NextResponse.json({ ok: true })
    }

    if (d.action === 'bulk') {
      if (['delete'].includes(d.op) && !['super_admin', 'administrator'].includes(auth.user.role))
        return NextResponse.json({ error: 'Delete requires elevated rights' }, { status: 403 })
      for (const id of d.ids) await applyLifecycle(d.op === 'delete' ? 'delete' : d.op, id, uid, auth.user)
      await logAction(auth.user, 'hero.bulk', 'heroes', d.ids.join(','), { op: d.op })
      return NextResponse.json({ ok: true, count: d.ids.length })
    }

    // Single lifecycle action
    const res = await applyLifecycle(d.action, d.id, uid, auth.user, d.version)
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
    return NextResponse.json(res)
  } catch (e) { return apiError(e, 'Failed to update hero') }
}

async function applyLifecycle(action: string, id: number, uid: string, user: AdminUser, version?: number): Promise<Record<string, unknown> & { error?: string; status?: number }> {
  const hero = await getHero(id); if (!hero) return { error: 'Not found', status: 404 }
  if (action === 'publish') {
    if (!canPublish(hero.config as HeroConfig)) return { error: 'Validation failed — resolve errors before publishing', status: 400 }
    await snapshotVersion(id, 'publish', uid)
    await pgQuery(`UPDATE heroes SET status='published', published_at=${NOW}, updated_at=${NOW} WHERE id=$1`, [id])
    // Only one published hero per exact target path.
    if (hero.targetPath) await pgQuery(`UPDATE heroes SET status='approved' WHERE id<>$1 AND status='published' AND target_path=$2`, [id, hero.targetPath])
    await logAction(user, 'hero.publish', 'heroes', String(id), {})
    return { ok: true, status_: 'published' }
  }
  if (action === 'duplicate') {
    let slug = `${hero.slug}-copy`; let n = 1
    while ((await pgQuery(`SELECT 1 FROM heroes WHERE slug=$1`, [slug])).length) slug = `${hero.slug}-copy-${++n}`
    const row = (await pgQuery<{ id: number }>(
      `INSERT INTO heroes (slug, name, template, category, tags, config, target_path, author_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,${NOW},${NOW}) RETURNING id`,
      [slug, `${hero.name} (copy)`, hero.template, hero.category, JSON.stringify(hero.tags), JSON.stringify(hero.config), uid]))[0]
    return { id: row.id }
  }
  if (action === 'delete') { await pgQuery(`DELETE FROM heroes WHERE id=$1`, [id]); return { ok: true } }
  if (action === 'rollback') {
    const v = (await pgQuery<{ config: string }>(`SELECT config FROM hero_versions WHERE hero_id=$1 AND version=$2`, [id, version]))[0]
    if (!v) return { error: 'Version not found', status: 404 }
    await snapshotVersion(id, `rollback→v${version}`, uid)
    await pgQuery(`UPDATE heroes SET config=$2, version=version+1, updated_at=${NOW} WHERE id=$1`, [id, v.config])
    await logAction(user, 'hero.rollback', 'heroes', String(id), { version })
    return { ok: true }
  }
  const next = STATUS_FLOW[action]
  if (next) { await pgQuery(`UPDATE heroes SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, next]); return { ok: true, status_: next } }
  return { error: 'Unknown action', status: 400 }
}
