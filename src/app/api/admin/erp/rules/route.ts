import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { validateRuleSet, type RuleSet } from '@/lib/rules/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

interface RuleRow { id: number; key: string; nameEn: string; nameFa: string | null; category: string; description: string | null; currentVersion: number; activeVersion: number; status: string }

// GET — list rule sets, or one with its version history (?id=).
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.rules', 'read')
  if ('error' in auth) return auth.error
  try {
    const id = Number(req.nextUrl.searchParams.get('id'))
    if (id) {
      const rule = (await pgQuery(
        `SELECT id, key, name_en AS "nameEn", name_fa AS "nameFa", category, description,
                current_version AS "currentVersion", active_version AS "activeVersion", status
         FROM business_rules WHERE id=$1`, [id]))[0] as unknown as RuleRow | undefined
      if (!rule) return badRequest('Not found')
      const versions = await pgQuery(`SELECT id, version, definition, note, created_at AS "createdAt" FROM business_rule_versions WHERE rule_id=$1 ORDER BY version DESC`, [id])
      return NextResponse.json({ rule, versions })
    }
    const rules = await pgQuery(
      `SELECT id, key, name_en AS "nameEn", name_fa AS "nameFa", category, description,
              current_version AS "currentVersion", active_version AS "activeVersion", status
       FROM business_rules ORDER BY category, key`, [])
    return NextResponse.json({ rules })
  } catch (e) { return apiError(e, 'Failed to load rules') }
}

const createSchema = z.object({
  key: z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/, 'lowercase letters, digits, - and _ only'),
  nameEn: z.string().min(1).max(160),
  nameFa: z.string().max(160).optional(),
  category: z.string().min(1).max(40).default('general'),
  description: z.string().max(500).optional(),
  definition: z.string().min(2).max(40000),
})

function checkDef(json: string): { ok: true; def: RuleSet } | { ok: false; error: string } {
  let def: RuleSet
  try { def = JSON.parse(json) } catch { return { ok: false, error: 'definition is not valid JSON' } }
  const v = validateRuleSet(def)
  return v.valid ? { ok: true, def } : { ok: false, error: v.error ?? 'invalid rule set' }
}

// POST — create a rule set (version 1).
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.rules', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, createSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const chk = checkDef(d.definition)
  if (!chk.ok) return badRequest(chk.error)
  try {
    if ((await pgQuery(`SELECT id FROM business_rules WHERE key=$1`, [d.key]))[0]) return badRequest('A rule with this key already exists')
    const rule = (await pgQuery(
      `INSERT INTO business_rules (key, name_en, name_fa, category, description, current_version, active_version, status, owner_id, updated_at)
       VALUES ($1,$2,$3,$4,$5,1,1,'draft',$6,${NOW}) RETURNING id`,
      [d.key, d.nameEn, d.nameFa ?? null, d.category, d.description ?? null, auth.user.id]))[0] as { id: number }
    await pgQuery(`INSERT INTO business_rule_versions (rule_id, version, definition, note, author_id) VALUES ($1,1,$2,'initial',$3)`, [rule.id, d.definition, auth.user.id])
    await logAction(auth.user, 'rule.create', 'business_rule', rule.id, null, { key: d.key })
    return NextResponse.json({ id: rule.id })
  } catch (e) { return apiError(e, 'Failed to create rule') }
}

const opSchema = z.object({
  id: z.number().int().positive(),
  op: z.enum(['newVersion', 'setActive', 'activate', 'archive', 'meta']),
  definition: z.string().max(40000).optional(),
  note: z.string().max(500).optional(),
  version: z.number().int().positive().optional(),
  nameEn: z.string().max(160).optional(),
  nameFa: z.string().max(160).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(40).optional(),
})

// PUT — add a version, roll the active version back, activate/archive, edit meta.
export async function PUT(req: NextRequest) {
  const auth = await requirePermission('erp.rules', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, opSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const rule = (await pgQuery(`SELECT current_version AS "cv" FROM business_rules WHERE id=$1`, [d.id]))[0] as { cv: number } | undefined
    if (!rule) return badRequest('Not found')
    switch (d.op) {
      case 'newVersion': {
        if (!d.definition) return badRequest('definition required')
        const chk = checkDef(d.definition)
        if (!chk.ok) return badRequest(chk.error)
        const next = rule.cv + 1
        await pgQuery(`INSERT INTO business_rule_versions (rule_id, version, definition, note, author_id) VALUES ($1,$2,$3,$4,$5)`, [d.id, next, d.definition, d.note ?? null, auth.user.id])
        await pgQuery(`UPDATE business_rules SET current_version=$1, active_version=$1, updated_at=${NOW} WHERE id=$2`, [next, d.id])
        await logAction(auth.user, 'rule.version', 'business_rule', d.id, null, { version: next })
        return NextResponse.json({ ok: true, version: next })
      }
      case 'setActive': {
        if (!d.version) return badRequest('version required')
        if (!(await pgQuery(`SELECT id FROM business_rule_versions WHERE rule_id=$1 AND version=$2`, [d.id, d.version]))[0]) return badRequest('Unknown version')
        await pgQuery(`UPDATE business_rules SET active_version=$1, updated_at=${NOW} WHERE id=$2`, [d.version, d.id])
        await logAction(auth.user, 'rule.rollback', 'business_rule', d.id, null, { activeVersion: d.version })
        return NextResponse.json({ ok: true })
      }
      case 'activate':
        await pgQuery(`UPDATE business_rules SET status='active', updated_at=${NOW} WHERE id=$1`, [d.id])
        await logAction(auth.user, 'rule.activate', 'business_rule', d.id)
        return NextResponse.json({ ok: true })
      case 'archive':
        await pgQuery(`UPDATE business_rules SET status='archived', updated_at=${NOW} WHERE id=$1`, [d.id])
        await logAction(auth.user, 'rule.archive', 'business_rule', d.id)
        return NextResponse.json({ ok: true })
      case 'meta':
        await pgQuery(`UPDATE business_rules SET name_en=COALESCE($2,name_en), name_fa=COALESCE($3,name_fa), description=COALESCE($4,description), category=COALESCE($5,category), updated_at=${NOW} WHERE id=$1`,
          [d.id, d.nameEn ?? null, d.nameFa ?? null, d.description ?? null, d.category ?? null])
        return NextResponse.json({ ok: true })
    }
  } catch (e) { return apiError(e, 'Rule operation failed') }
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission('erp.rules', 'write', 'delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    await pgQuery(`DELETE FROM business_rules WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'rule.delete', 'business_rule', parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete rule') }
}
