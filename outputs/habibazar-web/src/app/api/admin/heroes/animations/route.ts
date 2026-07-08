import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import {
  buildPackage, verifyPackage, validateDependencies, planImport, animationAnalytics,
  type HeroPackage, type UsageRow,
} from '@/lib/hero/animationLibrary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const secret = () => process.env.BACKUP_ENCRYPTION_KEY || process.env.ADMIN_JWT_SECRET || 'hbz-dev-secret'

interface PresetRow {
  id: number; key: string; name_en: string; name_fa: string; category: string; base_preset: string | null
  config: string; tags: string; collection_id: number | null; enabled: boolean; archived: boolean
  favorite: boolean; usage_count: number; version: number; created_at: string; updated_at: string
}
const parse = <T,>(s: string, f: T): T => { try { return JSON.parse(s) as T } catch { return f } }
const toItem = (r: PresetRow) => ({
  id: r.id, key: r.key, nameEn: r.name_en, nameFa: r.name_fa, category: r.category, basePreset: r.base_preset,
  config: parse<Record<string, unknown>>(r.config, {}), tags: parse<string[]>(r.tags, []),
  collectionId: r.collection_id, enabled: r.enabled, archived: r.archived, favorite: r.favorite,
  usageCount: r.usage_count, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at,
})

// GET — list presets (filters) | ?view=analytics | ?view=export (signed package) | ?id= detail+versions
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const sp = req.nextUrl.searchParams
    const view = sp.get('view')
    if (view === 'analytics') {
      const rows = await pgQuery<PresetRow>(`SELECT * FROM hero_animation_presets`)
      const usage: UsageRow[] = rows.map(r => ({ key: r.key, nameEn: r.name_en, category: r.category, usageCount: r.usage_count, enabled: r.enabled }))
      return NextResponse.json(animationAnalytics(usage, rows.filter(r => r.archived).length))
    }
    if (view === 'export') {
      const rows = await pgQuery<PresetRow>(`SELECT * FROM hero_animation_presets WHERE archived=false`)
      const items = rows.map(r => ({ key: r.key, nameEn: r.name_en, nameFa: r.name_fa, category: r.category, basePreset: r.base_preset ?? undefined, config: parse<Record<string, unknown>>(r.config, {}), tags: parse<string[]>(r.tags, []) }))
      const pkg = buildPackage({ kind: 'animation', name: 'HBZ Animation Library', version: '1.0.0', author: auth.user.email, organization: 'HBZ Technology' }, items, secret())
      return NextResponse.json(pkg)
    }
    if (sp.get('id')) {
      const id = Number(sp.get('id'))
      const row = (await pgQuery<PresetRow>(`SELECT * FROM hero_animation_presets WHERE id=$1`, [id]))[0]
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const versions = await pgQuery(`SELECT id, version, note, created_at FROM hero_animation_versions WHERE preset_id=$1 ORDER BY version DESC`, [id])
      return NextResponse.json({ preset: toItem(row), versions })
    }
    const category = sp.get('category'); const q = sp.get('q'); const fav = sp.get('favorite')
    const where: string[] = []; const args: unknown[] = []
    if (category && category !== 'all') { args.push(category); where.push(`category=$${args.length}`) }
    if (fav === '1') where.push('favorite=true')
    if (q) { args.push(`%${q.toLowerCase()}%`); where.push(`(lower(name_en) LIKE $${args.length} OR lower(name_fa) LIKE $${args.length} OR lower(key) LIKE $${args.length})`) }
    const rows = await pgQuery<PresetRow>(`SELECT * FROM hero_animation_presets ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY archived, favorite DESC, usage_count DESC, updated_at DESC`, args)
    return NextResponse.json({ presets: rows.map(toItem) })
  } catch (e) { return apiError(e, 'Failed to load animation library') }
}

const presetInput = z.object({
  key: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  nameEn: z.string().min(1).max(80), nameFa: z.string().min(1).max(80),
  category: z.string().max(30), basePreset: z.string().max(40).optional(),
  config: z.record(z.string(), z.unknown()).default({}), tags: z.array(z.string().max(30)).max(20).default([]),
})
const create = z.object({ action: z.literal('create') }).merge(presetInput)
const update = z.object({ action: z.literal('update'), id: z.number().int() }).merge(presetInput.partial())
const toggle = z.object({ action: z.literal('toggle'), id: z.number().int(), field: z.enum(['favorite', 'enabled', 'archived']), value: z.boolean() })
const rollback = z.object({ action: z.literal('rollback'), id: z.number().int(), version: z.number().int() })
const bulk = z.object({ action: z.literal('bulk'), op: z.enum(['archive', 'restore', 'enable', 'disable', 'delete', 'favorite']), ids: z.array(z.number().int()).min(1).max(200) })
const importPkg = z.object({ action: z.literal('import'), pkg: z.record(z.string(), z.unknown()) })
const body = z.discriminatedUnion('action', [create, update, toggle, rollback, bulk, importPkg])

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data; const uid = auth.user.id
  try {
    if (d.action === 'create') {
      const dup = await pgQuery(`SELECT 1 FROM hero_animation_presets WHERE key=$1`, [d.key])
      if (dup.length) return NextResponse.json({ error: 'Key already exists' }, { status: 409 })
      const row = (await pgQuery<{ id: number }>(
        `INSERT INTO hero_animation_presets (key,name_en,name_fa,category,base_preset,config,tags,created_by,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,${NOW},${NOW}) RETURNING id`,
        [d.key, d.nameEn, d.nameFa, d.category, d.basePreset ?? null, JSON.stringify(d.config), JSON.stringify(d.tags), uid]))[0]
      await logAction(auth.user, 'hero.anim.create', 'hero_animation_presets', String(row.id), { key: d.key })
      return NextResponse.json({ id: row.id })
    }
    if (d.action === 'update') {
      const cur = (await pgQuery<PresetRow>(`SELECT * FROM hero_animation_presets WHERE id=$1`, [d.id]))[0]
      if (!cur) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (d.config !== undefined) // snapshot previous config for versioning
        await pgQuery(`INSERT INTO hero_animation_versions (preset_id,version,config,note,author_id,created_at) VALUES ($1,$2,$3,'edit',$4,${NOW})`, [d.id, cur.version, cur.config, uid])
      await pgQuery(
        `UPDATE hero_animation_presets SET name_en=COALESCE($2,name_en), name_fa=COALESCE($3,name_fa), category=COALESCE($4,category),
           base_preset=COALESCE($5,base_preset), config=COALESCE($6,config), tags=COALESCE($7,tags),
           version=CASE WHEN $6 IS NULL THEN version ELSE version+1 END, updated_at=${NOW} WHERE id=$1`,
        [d.id, d.nameEn ?? null, d.nameFa ?? null, d.category ?? null, d.basePreset ?? null, d.config ? JSON.stringify(d.config) : null, d.tags ? JSON.stringify(d.tags) : null])
      await logAction(auth.user, 'hero.anim.update', 'hero_animation_presets', String(d.id), {})
      return NextResponse.json({ ok: true })
    }
    if (d.action === 'toggle') {
      await pgQuery(`UPDATE hero_animation_presets SET ${d.field}=$2, updated_at=${NOW} WHERE id=$1`, [d.id, d.value])
      return NextResponse.json({ ok: true })
    }
    if (d.action === 'rollback') {
      const v = (await pgQuery<{ config: string }>(`SELECT config FROM hero_animation_versions WHERE preset_id=$1 AND version=$2`, [d.id, d.version]))[0]
      if (!v) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
      const cur = (await pgQuery<PresetRow>(`SELECT version, config FROM hero_animation_presets WHERE id=$1`, [d.id]))[0]
      await pgQuery(`INSERT INTO hero_animation_versions (preset_id,version,config,note,author_id,created_at) VALUES ($1,$2,$3,$4,$5,${NOW})`, [d.id, cur.version, cur.config, `rollback→v${d.version}`, uid])
      await pgQuery(`UPDATE hero_animation_presets SET config=$2, version=version+1, updated_at=${NOW} WHERE id=$1`, [d.id, v.config])
      await logAction(auth.user, 'hero.anim.rollback', 'hero_animation_presets', String(d.id), { version: d.version })
      return NextResponse.json({ ok: true })
    }
    if (d.action === 'bulk') {
      if (d.op === 'delete' && !['super_admin', 'administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'Delete requires elevated rights' }, { status: 403 })
      const map: Record<string, string> = { archive: 'archived=true', restore: 'archived=false', enable: 'enabled=true', disable: 'enabled=false', favorite: 'favorite=true' }
      if (d.op === 'delete') await pgQuery(`DELETE FROM hero_animation_presets WHERE id = ANY($1)`, [d.ids])
      else await pgQuery(`UPDATE hero_animation_presets SET ${map[d.op]}, updated_at=${NOW} WHERE id = ANY($1)`, [d.ids])
      await logAction(auth.user, 'hero.anim.bulk', 'hero_animation_presets', d.ids.join(','), { op: d.op })
      return NextResponse.json({ ok: true, count: d.ids.length })
    }
    if (d.action === 'import') {
      // Import requires elevated rights (installs signed packages).
      if (!['super_admin', 'administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'Import requires administrator' }, { status: 403 })
      const pkg = d.pkg as unknown as HeroPackage
      const verify = verifyPackage(pkg, secret())
      if (!verify.ok) return NextResponse.json({ error: 'Package verification failed', reasons: verify.reasons }, { status: 400 })
      const deps = validateDependencies(pkg)
      if (!deps.ok) return NextResponse.json({ error: 'Missing dependencies', deps }, { status: 400 })
      const existing = (await pgQuery<{ key: string }>(`SELECT key FROM hero_animation_presets`)).map(r => r.key)
      const plan = planImport(pkg, existing)
      for (const it of plan.toCreate)
        await pgQuery(`INSERT INTO hero_animation_presets (key,name_en,name_fa,category,base_preset,config,tags,created_by,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,${NOW},${NOW})`,
          [it.key, it.nameEn, it.nameFa, it.category, it.basePreset ?? null, JSON.stringify(it.config), JSON.stringify(it.tags ?? []), uid])
      await logAction(auth.user, 'hero.anim.import', 'hero_animation_presets', '', { created: plan.toCreate.length, conflicts: plan.conflicts.length })
      return NextResponse.json({ ok: true, created: plan.toCreate.length, conflicts: plan.conflicts, invalid: plan.invalid })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) { return apiError(e, 'Failed to update animation library') }
}
