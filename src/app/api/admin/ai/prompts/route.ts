import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { extractVariables } from '@/lib/ai/prompts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

interface PromptRow {
  id: number; key: string; nameEn: string; nameFa: string | null; category: string
  description: string | null; currentVersion: number; activeVersion: number; status: string
}

// GET — list prompts, or one prompt's full version history (?id=).
export async function GET(req: NextRequest) {
  const auth = await requirePermission('ai.ai-agents', 'read')
  if ('error' in auth) return auth.error
  try {
    const id = Number(req.nextUrl.searchParams.get('id'))
    if (id) {
      const prompt = (await pgQuery(
        `SELECT id, key, name_en AS "nameEn", name_fa AS "nameFa", category, description,
                current_version AS "currentVersion", active_version AS "activeVersion", status
         FROM ai_prompts WHERE id=$1`, [id],
      ))[0] as unknown as PromptRow | undefined
      if (!prompt) return badRequest('Not found')
      const versions = await pgQuery(
        `SELECT id, version, body, note, created_at AS "createdAt"
         FROM ai_prompt_versions WHERE prompt_id=$1 ORDER BY version DESC`, [id],
      )
      return NextResponse.json({ prompt, versions })
    }
    const prompts = await pgQuery(
      `SELECT id, key, name_en AS "nameEn", name_fa AS "nameFa", category, description,
              current_version AS "currentVersion", active_version AS "activeVersion", status,
              (SELECT body FROM ai_prompt_versions v WHERE v.prompt_id=p.id AND v.version=p.active_version) AS "activeBody"
       FROM ai_prompts p ORDER BY category, key`, [],
    )
    return NextResponse.json({ prompts })
  } catch (e) {
    return apiError(e, 'Failed to load prompts')
  }
}

const createSchema = z.object({
  key: z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/, 'lowercase letters, digits, - and _ only'),
  nameEn: z.string().min(1).max(160),
  nameFa: z.string().max(160).optional(),
  category: z.string().min(1).max(40).default('general'),
  description: z.string().max(500).optional(),
  body: z.string().min(1).max(20000),
})

// POST — create a new prompt (version 1).
export async function POST(req: NextRequest) {
  const auth = await requirePermission('ai.ai-agents', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, createSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const dup = (await pgQuery(`SELECT id FROM ai_prompts WHERE key=$1`, [d.key]))[0]
    if (dup) return badRequest('A prompt with this key already exists')
    const prompt = (await pgQuery(
      `INSERT INTO ai_prompts (key, name_en, name_fa, category, description, current_version, active_version, status, owner_id, updated_at)
       VALUES ($1,$2,$3,$4,$5,1,1,'draft',$6,${NOW}) RETURNING id`,
      [d.key, d.nameEn, d.nameFa ?? null, d.category, d.description ?? null, auth.user.id],
    ))[0] as { id: number }
    await pgQuery(
      `INSERT INTO ai_prompt_versions (prompt_id, version, body, note, author_id) VALUES ($1,1,$2,'initial',$3)`,
      [prompt.id, d.body, auth.user.id],
    )
    await logAction(auth.user, 'ai.prompt.create', 'ai_prompt', prompt.id, null, { key: d.key })
    return NextResponse.json({ id: prompt.id, variables: extractVariables(d.body) })
  } catch (e) {
    return apiError(e, 'Failed to create prompt')
  }
}

const opSchema = z.object({
  id: z.number().int().positive(),
  op: z.enum(['newVersion', 'setActive', 'approve', 'archive', 'meta']),
  body: z.string().max(20000).optional(),
  note: z.string().max(500).optional(),
  version: z.number().int().positive().optional(),
  nameEn: z.string().max(160).optional(),
  nameFa: z.string().max(160).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(40).optional(),
})

// PUT — versioned operations: add a version, roll the active version, approve,
// archive, or edit metadata. Bodies are immutable per version.
export async function PUT(req: NextRequest) {
  const auth = await requirePermission('ai.ai-agents', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, opSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const p = (await pgQuery(`SELECT current_version AS "cv" FROM ai_prompts WHERE id=$1`, [d.id]))[0] as { cv: number } | undefined
    if (!p) return badRequest('Not found')

    switch (d.op) {
      case 'newVersion': {
        if (!d.body || !d.body.trim()) return badRequest('Version body required')
        const next = p.cv + 1
        await pgQuery(
          `INSERT INTO ai_prompt_versions (prompt_id, version, body, note, author_id) VALUES ($1,$2,$3,$4,$5)`,
          [d.id, next, d.body, d.note ?? null, auth.user.id],
        )
        // New version becomes current + active head.
        await pgQuery(`UPDATE ai_prompts SET current_version=$1, active_version=$1, updated_at=${NOW} WHERE id=$2`, [next, d.id])
        await logAction(auth.user, 'ai.prompt.version', 'ai_prompt', d.id, null, { version: next })
        return NextResponse.json({ ok: true, version: next })
      }
      case 'setActive': {
        if (!d.version) return badRequest('version required')
        const exists = (await pgQuery(`SELECT id FROM ai_prompt_versions WHERE prompt_id=$1 AND version=$2`, [d.id, d.version]))[0]
        if (!exists) return badRequest('Unknown version')
        await pgQuery(`UPDATE ai_prompts SET active_version=$1, updated_at=${NOW} WHERE id=$2`, [d.version, d.id])
        await logAction(auth.user, 'ai.prompt.rollback', 'ai_prompt', d.id, null, { activeVersion: d.version })
        return NextResponse.json({ ok: true })
      }
      case 'approve':
        await pgQuery(`UPDATE ai_prompts SET status='approved', updated_at=${NOW} WHERE id=$1`, [d.id])
        await logAction(auth.user, 'ai.prompt.approve', 'ai_prompt', d.id)
        return NextResponse.json({ ok: true })
      case 'archive':
        await pgQuery(`UPDATE ai_prompts SET status='archived', updated_at=${NOW} WHERE id=$1`, [d.id])
        await logAction(auth.user, 'ai.prompt.archive', 'ai_prompt', d.id)
        return NextResponse.json({ ok: true })
      case 'meta':
        await pgQuery(
          `UPDATE ai_prompts SET name_en=COALESCE($2,name_en), name_fa=COALESCE($3,name_fa),
                  description=COALESCE($4,description), category=COALESCE($5,category), updated_at=${NOW} WHERE id=$1`,
          [d.id, d.nameEn ?? null, d.nameFa ?? null, d.description ?? null, d.category ?? null],
        )
        return NextResponse.json({ ok: true })
    }
  } catch (e) {
    return apiError(e, 'Prompt operation failed')
  }
}

// DELETE — remove a prompt and its versions.
export async function DELETE(req: NextRequest) {
  const auth = await requirePermission('ai.ai-agents', 'write', 'delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    await pgQuery(`DELETE FROM ai_prompts WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'ai.prompt.delete', 'ai_prompt', parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e, 'Failed to delete prompt')
  }
}
