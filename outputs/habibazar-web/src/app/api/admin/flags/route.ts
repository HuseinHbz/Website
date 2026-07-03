import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type Database from 'better-sqlite3'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { isEnabled, type Flag } from '@/lib/flags/evaluate'

// Feature Flag Center API. Reuses zod validation, requireAdmin RBAC and audit
// logging. GET evaluates each flag for the current admin (as rollout subject) so
// the UI can preview cohort membership.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function client(): Database.Database {
  return (getDb() as unknown as { $client: Database.Database }).$client
}

const schema = z.object({
  id: z.number().int().positive().optional(),
  key: z.string().trim().min(1).max(80).regex(/^[a-z0-9_.-]+$/i, 'letters, digits, . _ - only'),
  description: z.string().trim().max(500).optional().nullable(),
  enabled: z.boolean().optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
})

export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    const rows = client().prepare(
      `SELECT id, key, description, enabled, rollout_percent AS rolloutPercent, updated_at AS updatedAt
       FROM feature_flags ORDER BY key`
    ).all() as (Flag & { id: number; enabled: number | boolean })[]
    const flags = rows.map((r) => {
      const flag: Flag = { key: r.key, enabled: !!r.enabled, rolloutPercent: r.rolloutPercent }
      return { ...r, enabled: !!r.enabled, evaluatedForMe: isEnabled(flag, auth.user.id) }
    })
    return NextResponse.json({ flags })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin('manage_settings')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, schema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    try {
      const result = client().prepare(
        `INSERT INTO feature_flags (key, description, enabled, rollout_percent, owner_id)
         VALUES (@key,@description,@enabled,@rolloutPercent,@ownerId) RETURNING id`
      ).get({
        key: d.key, description: d.description || null, enabled: d.enabled ? 1 : 0,
        rolloutPercent: d.rolloutPercent ?? 100, ownerId: auth.user.id,
      }) as { id: number }
      await logAction(auth.user, 'CREATE', 'feature_flags', result.id, null, d)
      return NextResponse.json({ id: result.id })
    } catch (e) {
      if (String(e).includes('UNIQUE')) return badRequest('a flag with that key already exists')
      throw e
    }
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin('manage_settings')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, schema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    if (!d.id) return badRequest('id required')
    const db = client()
    const existing = db.prepare(`SELECT * FROM feature_flags WHERE id=?`).get(d.id) as Record<string, unknown> | undefined
    if (!existing) return badRequest('flag not found')
    db.prepare(
      `UPDATE feature_flags SET key=@key, description=@description, enabled=@enabled,
        rollout_percent=@rolloutPercent, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id: d.id, key: d.key, description: d.description ?? existing.description ?? null,
      enabled: (d.enabled ?? !!existing.enabled) ? 1 : 0,
      rolloutPercent: d.rolloutPercent ?? existing.rollout_percent,
    })
    await logAction(auth.user, 'UPDATE', 'feature_flags', d.id, existing, d)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin('manage_settings')
    if ('error' in auth) return auth.error
    const { id } = await req.json().catch(() => ({}))
    if (!id || typeof id !== 'number') return badRequest('id required')
    client().prepare(`DELETE FROM feature_flags WHERE id=?`).run(id)
    await logAction(auth.user, 'DELETE', 'feature_flags', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
