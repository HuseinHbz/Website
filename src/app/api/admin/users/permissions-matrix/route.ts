import { NextRequest, NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { permissionTree } from '@/lib/rbac/registry'
import { effectiveLevel } from '@/lib/rbac/engine'
import { loadUserRbac } from '@/lib/rbac/data'
import { pgQuery } from '@/lib/db'

/**
 * 26.27 بند ۴ — users × modules effective-permission matrix (+ CSV for the
 * auditor via ?format=csv). Effective = explicit tree result or "(role)" when
 * the legacy role default applies (no grant on the chain).
 */
export async function GET(req: NextRequest) {
  const auth = await requirePermission('security.users', 'read', 'manage_users')
  if ('error' in auth) return auth.error
  try {
    const users = await pgQuery<{ id: string; name: string; email: string; role: string; active: number }>(
      `SELECT id, name, email, role, active FROM users ORDER BY name`)
    const modules = permissionTree().nodes.filter(n => n.kind === 'module')
    const rows: Array<{ user: string; email: string; role: string; levels: Record<string, string> }> = []
    for (const u of users) {
      const rbac = await loadUserRbac(u.id)
      const levels: Record<string, string> = {}
      for (const m of modules) {
        const lv = effectiveLevel(rbac.grants, m.key)
        levels[m.key] = lv ?? `(${u.role})`
      }
      rows.push({ user: u.name, email: u.email, role: u.role, levels })
    }
    const url = new URL(req.url)
    if (url.searchParams.get('format') === 'csv') {
      const esc = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      const header = ['user', 'email', 'role', ...modules.map(m => m.key)].map(esc).join(',')
      const body = rows.map(r => [r.user, r.email, r.role, ...modules.map(m => r.levels[m.key])].map(esc).join(',')).join('\n')
      return new NextResponse('﻿' + header + '\n' + body, {
        headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="permissions-matrix.csv"' },
      })
    }
    return NextResponse.json({ modules: modules.map(m => ({ key: m.key, labelEn: m.labelEn, labelFa: m.labelFa })), rows })
  } catch (e) { return apiError(e) }
}
