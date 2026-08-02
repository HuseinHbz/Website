import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission, requireOp } from '@/lib/api/respond'
import { permissionTree, allOpKeys, SCOPED_MODULES } from '@/lib/rbac/registry'
import { resolveTree } from '@/lib/rbac/engine'
import { loadUserRbac, setGrant, setOp, setRowScope, copyRbac } from '@/lib/rbac/data'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'

/**
 * 26.27 بند ۴ — permission tree of one user.
 * GET: full resolved tree (level + provenance) + ops + scopes + templates.
 * POST: set/clear a grant, op or row-scope; apply a template; copy from a user.
 * Guarded by security.users write + the grant_edit sensitive op — a user who
 * cannot manage users can NEVER change their own or anyone's grants (بند ۷).
 */

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('grant'), key: z.string().min(1).max(120), level: z.enum(['none', 'read', 'write']).nullable() }),
  z.object({ action: z.literal('op'), opKey: z.string().min(3).max(140), allowed: z.boolean().nullable() }),
  z.object({ action: z.literal('scope'), key: z.string().min(1).max(120), scope: z.enum(['all', 'own', 'department', 'company']).nullable() }),
  z.object({ action: z.literal('template'), templateId: z.number().int().positive() }),
  z.object({ action: z.literal('copy'), fromUserId: z.string().min(1) }),
])

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('security.users', 'read', 'manage_users')
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    const target = (await pgQuery<{ id: string; name: string; email: string; role: string }>(
      `SELECT id, name, email, role FROM users WHERE id=$1`, [id]))[0]
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const rbac = await loadUserRbac(id)
    const { nodes } = permissionTree()
    const tree = resolveTree(rbac.grants, nodes.map(n => n.key))
    const scopes = await pgQuery<{ permission_key: string; scope: string }>(
      `SELECT permission_key, scope FROM rbac_row_scope WHERE user_id=$1`, [id])
    const templates = await pgQuery<{ id: number; name: string; name_fa: string; is_system: boolean }>(
      `SELECT id, name, name_fa, is_system FROM rbac_role_templates ORDER BY id`)
    const audit = await pgQuery<{ actor_id: string; permission_key: string; old_value: string | null; new_value: string | null; created_at: string }>(
      `SELECT actor_id, permission_key, old_value, new_value, created_at FROM rbac_audit WHERE target_user_id=$1 ORDER BY id DESC LIMIT 50`, [id])
    return NextResponse.json({
      user: target,
      nodes: nodes.map(n => ({ key: n.key, kind: n.kind, parent: n.parent, labelEn: n.labelEn, labelFa: n.labelFa, ops: n.ops ?? [] })),
      tree, grants: rbac.grants, ops: rbac.ops,
      opKeys: allOpKeys(),
      scopes: Object.fromEntries(scopes.map(s => [s.permission_key, s.scope])),
      scopedModules: SCOPED_MODULES,   // 26.28 بند ۲.۳ — only modules with a real server-side scope
      templates, audit,
    })
  } catch (e) { return apiError(e) }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('security.users', 'write', 'manage_users')
  if ('error' in auth) return auth.error
  { const deny = await requireOp(auth.user, 'security.users:grant_edit', 'manage_users'); if (deny) return deny }
  try {
    const { id } = await params
    const parsed = await readJson(req, bodySchema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    const exists = (await pgQuery<{ id: string }>(`SELECT id FROM users WHERE id=$1`, [id]))[0]
    if (!exists) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    switch (d.action) {
      case 'grant':
        await setGrant(auth.user.id, id, d.key, d.level)
        break
      case 'op':
        await setOp(auth.user.id, id, d.opKey, d.allowed)
        break
      case 'scope':
        await setRowScope(auth.user.id, id, d.key, d.scope)
        break
      case 'template': {
        const t = (await pgQuery<{ grants: string; ops: string; row_scopes: string }>(
          `SELECT grants, ops, row_scopes FROM rbac_role_templates WHERE id=$1`, [d.templateId]))[0]
        if (!t) return badRequest('Template not found')
        for (const [k, v] of Object.entries(JSON.parse(t.grants) as Record<string, 'none' | 'read' | 'write'>)) await setGrant(auth.user.id, id, k, v)
        for (const [k, v] of Object.entries(JSON.parse(t.ops) as Record<string, boolean>)) await setOp(auth.user.id, id, k, v)
        for (const [k, v] of Object.entries(JSON.parse(t.row_scopes) as Record<string, 'all' | 'own' | 'department' | 'company'>)) await setRowScope(auth.user.id, id, k, v)
        break
      }
      case 'copy':
        await copyRbac(auth.user.id, d.fromUserId, id)
        break
    }
    await logAction(auth.user, 'rbac.change', 'users', id, null, d as unknown as Record<string, unknown>)
    const rbac = await loadUserRbac(id)
    return NextResponse.json({ ok: true, grants: rbac.grants, ops: rbac.ops })
  } catch (e) { return apiError(e) }
}
