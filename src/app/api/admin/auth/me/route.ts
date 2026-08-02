import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin/auth'
import { loadUserRbac } from '@/lib/rbac/data'
import { pgQuery } from '@/lib/db'

const FINANCIAL_OP = /^(erp\.(finance|sales|purchasing|treasury|approvals|moadian))|^system\.settings\.integrations|^backup\.backup/

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // 26.27: explicit tree grants for grant-aware navigation (empty = role default)
  let grants: Record<string, string> = {}
  let needs2fa = false
  try {
    const rbac = await loadUserRbac(user.id)
    grants = rbac.grants
    // 26.28 بند ۱.۵ — gateway signal: when the mandatory-2FA policy is ON and this
    // user holds a financial-sensitive op but has no TOTP, the shell must push
    // them to enable it (the ops themselves already 403 via requireOp).
    const flag = (await pgQuery<{ value: string }>(
      `SELECT value FROM erp_settings WHERE key='2fa_required_sensitive'`))[0]?.value
    if (flag === '1') {
      const hasFinancialOp = Object.entries(rbac.ops).some(([k, v]) => v === true && FINANCIAL_OP.test(k))
      if (hasFinancialOp) {
        const u = (await pgQuery<{ totp_enabled: boolean }>(`SELECT totp_enabled FROM users WHERE id=$1`, [user.id]))[0]
        needs2fa = !u?.totp_enabled
      }
    }
  } catch { /* pre-migration */ }
  return NextResponse.json({ user, grants, needs2fa })
}
