import { getDb } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
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
  } catch {
    // Non-fatal
  }
}
