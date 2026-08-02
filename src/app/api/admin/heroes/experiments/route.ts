import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { experimentResult, type VariantCounts } from '@/lib/hero/experiment'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

interface ExpRow { id: number; key: string; name: string; target_path: string | null; status: string; variants: string; winner: string | null }

// GET — experiments + live results (from hero_events).
export async function GET() {
  const auth = await requirePermission('brand.hero', 'read')
  if ('error' in auth) return auth.error
  try {
    const rows = await pgQuery<ExpRow>(`SELECT id, key, name, target_path, status, variants, winner FROM hero_experiments ORDER BY updated_at DESC`)
    const out = []
    for (const r of rows) {
      const variants = JSON.parse(r.variants || '[]') as { id: string; heroId: number; weight: number }[]
      const counts: VariantCounts[] = []
      for (const v of variants) {
        const c = (await pgQuery<{ views: string; clicks: string; conv: string }>(
          `SELECT
             COUNT(*) FILTER (WHERE type='view') AS views,
             COUNT(*) FILTER (WHERE type='click') AS clicks,
             COUNT(*) FILTER (WHERE type='conversion') AS conv
           FROM hero_events WHERE experiment_key=$1 AND variant_id=$2`, [r.key, v.id]))[0]
        counts.push({ variantId: v.id, views: Number(c?.views ?? 0), clicks: Number(c?.clicks ?? 0), conversions: Number(c?.conv ?? 0) })
      }
      out.push({ id: r.id, key: r.key, name: r.name, targetPath: r.target_path, status: r.status, variants, winner: r.winner, result: experimentResult(counts) })
    }
    return NextResponse.json({ experiments: out })
  } catch (e) { return apiError(e, 'Failed to load experiments') }
}

const variantSchema = z.object({ id: z.string().max(20), heroId: z.number().int(), weight: z.number().min(0).max(100) })
const createSchema = z.object({ action: z.literal('create'), key: z.string().min(1).max(60), name: z.string().min(1).max(120), targetPath: z.string().max(200).optional(), variants: z.array(variantSchema).min(2).max(6) })
const opSchema = z.object({ action: z.enum(['start', 'stop', 'promote', 'delete']), id: z.number().int(), winner: z.string().max(20).optional() })
const body = z.discriminatedUnion('action', [createSchema, opSchema])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('brand.hero', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'create') {
      const row = (await pgQuery<{ id: number }>(
        `INSERT INTO hero_experiments (key, name, target_path, variants, created_at, updated_at) VALUES ($1,$2,$3,$4,${NOW},${NOW}) RETURNING id`,
        [d.key, d.name, d.targetPath ?? null, JSON.stringify(d.variants)]))[0]
      await logAction(auth.user, 'hero.experiment.create', 'hero_experiments', String(row.id), { key: d.key })
      return NextResponse.json({ id: row.id })
    }
    if (d.action === 'delete') { await pgQuery(`DELETE FROM hero_experiments WHERE id=$1`, [d.id]); return NextResponse.json({ ok: true }) }
    if (d.action === 'promote') {
      // Promote the winning variant's hero to the sole published hero for the path, and complete the experiment.
      const exp = (await pgQuery<ExpRow>(`SELECT key, target_path, variants FROM hero_experiments WHERE id=$1`, [d.id]))[0]
      if (!exp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const variants = JSON.parse(exp.variants || '[]') as { id: string; heroId: number }[]
      const win = variants.find(v => v.id === d.winner)
      if (win) {
        await pgQuery(`UPDATE heroes SET status='published', published_at=${NOW}, updated_at=${NOW} WHERE id=$1`, [win.heroId])
        if (exp.target_path) await pgQuery(`UPDATE heroes SET status='approved' WHERE id<>$1 AND status='published' AND target_path=$2`, [win.heroId, exp.target_path])
      }
      await pgQuery(`UPDATE hero_experiments SET status='completed', winner=$2, updated_at=${NOW} WHERE id=$1`, [d.id, d.winner ?? null])
      await logAction(auth.user, 'hero.experiment.promote', 'hero_experiments', String(d.id), { winner: d.winner })
      return NextResponse.json({ ok: true })
    }
    const status = d.action === 'start' ? 'running' : 'stopped'
    await pgQuery(`UPDATE hero_experiments SET status=$2, updated_at=${NOW} WHERE id=$1`, [d.id, status])
    await logAction(auth.user, `hero.experiment.${d.action}`, 'hero_experiments', String(d.id), {})
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to update experiment') }
}
