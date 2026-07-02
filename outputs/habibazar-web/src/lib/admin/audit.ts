import { getDb } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { logBus } from '@/lib/logs/bus'
import { scheduler } from '@/lib/backup/scheduler'
import type { AdminUser } from './auth'

export async function logAction(
  user: AdminUser | null,
  action: string,
  resource: string,
  resourceId?: string | number,
  oldValue?: unknown,
  newValue?: unknown,
  ipAddress?: string,
) {
  try {
    const db = getDb()
    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action,
      resource,
      resourceId: resourceId?.toString(),
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      ipAddress,
    })
    // Surface the audit event on the real-time log stream.
    logBus.publish({
      level: 'info', source: 'audit', service: 'admin',
      message: `[AUDIT] ${action} ${resource}${resourceId != null ? `:${resourceId}` : ''}`,
      userId: user?.id ?? null, meta: { action, resource, resourceId, ip: ipAddress },
    })
    // Event-driven backup: any admin data mutation debounces a backup.
    if (action !== 'LOGIN' && action !== 'LOGOUT') scheduler.notifyDataChange('data-change')
  } catch {
    // Non-fatal
  }
}
