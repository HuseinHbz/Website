import { NextRequest, NextResponse } from 'next/server'
import { apiError, guardJson, forbidden, unauthorized, checkTreePermission, requireOp } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { getAdminUser, hashPassword, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { nanoid } from 'nanoid'
import { pgQuery } from '@/lib/db'

const VALID_ROLES = ['super_admin', 'administrator', 'editor', 'auditor', 'viewer']

/** Next unique personnel code: EMP-0001, EMP-0002, … (26.22). */
async function nextEmployeeCode(): Promise<string> {
  const row = (await pgQuery<{ m: number }>(
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(employee_code, '\\D', '', 'g'), '')::int), 0) AS m FROM users WHERE employee_code LIKE 'EMP-%'`))[0]
  return `EMP-${String(Number(row?.m ?? 0) + 1).padStart(4, '0')}`
}

export async function GET() {
  try {      const me = await getAdminUser()
      if (me?.role !== 'super_admin' && me?.role !== 'administrator') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const db = getDb()
      const rows = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        employeeCode: users.employeeCode,
        department: users.department,
        active: users.active,
        totpEnabled: users.totpEnabled,
        createdAt: users.createdAt,
        lastLogin: users.lastLogin,
      }).from(users).orderBy(desc(users.createdAt))
      return NextResponse.json(rows)
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {      const me = await getAdminUser()
      if (!me) return unauthorized()
      { const deny = await checkTreePermission(me, 'security.users', 'write'); if (deny) return deny }
      if (me?.role !== 'super_admin' && me?.role !== 'administrator') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      { const deny = await requireOp(me, 'security.users:create', 'manage_users'); if (deny) return deny }
      const { name, email, password, role, department } = await guardJson(req)
      if (!name || !email || !password) return NextResponse.json({ error: 'Name, email, password required' }, { status: 400 })
      if (role && !VALID_ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      const hash = await hashPassword(password)
      const db = getDb()
      const result = await db.insert(users).values({
        id: nanoid(),
        name,
        email: email.toLowerCase(),
        passwordHash: hash,
        role: role || 'editor',
        employeeCode: await nextEmployeeCode(),
        department: department || null,
      }).returning()
      await logAction(me, 'CREATE', 'users', result[0]?.id, null, { name, email, role, department })
      return NextResponse.json({ id: result[0]?.id, email: result[0]?.email })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {      const me = await getAdminUser()
      if (!me) return unauthorized()
      { const deny = await checkTreePermission(me, 'security.users', 'write'); if (deny) return deny }
      if (me?.role !== 'super_admin' && me?.role !== 'administrator') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { id, password, ...data } = await guardJson(req)
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      if (data.role && !VALID_ROLES.includes(data.role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      if (data.role) { const deny = await requireOp(me, 'security.users:role_change', 'manage_users'); if (deny) return deny }
      const db = getDb()
      const updateData: Record<string, unknown> = { ...data }
      if (password) updateData.passwordHash = await hashPassword(password)
      await db.update(users).set(updateData).where(eq(users.id, id))
      await logAction(me, 'UPDATE', 'users', id, null, data)
      return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {      const me = await getAdminUser()
      if (!me || !canDo(me.role, 'delete')) return forbidden('Delete requires an administrator role')
      if (me?.role !== 'super_admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { id } = await guardJson(req)
      if (id === me.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
      const db = getDb()
      // Nullify all FK references before delete
      const tables = ['audit_logs', 'media_files', 'about_content', 'timeline_items', 'skills',
        'certifications', 'services', 'projects', 'clients', 'blog_posts', 'site_settings', 'ai_knowledge_base']
      const cols: Record<string, string> = { audit_logs: 'user_id', media_files: 'uploaded_by' }
      for (const t of tables) {
        const col = cols[t] ?? 'updated_by'
        try { await db.execute(sql`UPDATE ${sql.identifier(t)} SET ${sql.identifier(col)} = NULL WHERE ${sql.identifier(col)} = ${id}`) } catch { /* ok */ }
      }
      await db.delete(users).where(eq(users.id, id))
      await logAction(me, 'DELETE', 'users', id)
      return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
