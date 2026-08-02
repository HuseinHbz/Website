import { NextResponse } from 'next/server'
import { checkTreePermission } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { aiConversations, aiModules } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  { const deny = await checkTreePermission(user, 'ai.ai-analytics', 'read'); if (deny) return deny }

  const db = getDb()
  const convs = await db.select().from(aiConversations).orderBy(desc(aiConversations.createdAt)).limit(500)
  const modules = await db.select().from(aiModules)

  const totalConversations = convs.length
  const bookmarked = convs.filter(c => c.bookmarked).length

  // Usage per module
  const moduleUsage: Record<string, number> = {}
  for (const c of convs) {
    if (c.moduleSlug) moduleUsage[c.moduleSlug] = (moduleUsage[c.moduleSlug] || 0) + 1
  }

  // Usage per day (last 14 days)
  const dayMap: Record<string, number> = {}
  const now = Date.now()
  for (const c of convs) {
    const d = c.createdAt.slice(0, 10)
    const ts = new Date(c.createdAt).getTime()
    if (now - ts < 14 * 86400000) dayMap[d] = (dayMap[d] || 0) + 1
  }
  const dailyActivity = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }))

  // Total messages across all convs
  let totalMessages = 0
  for (const c of convs) {
    try { totalMessages += (JSON.parse(c.messagesJson) as unknown[]).length } catch { /* skip */ }
  }

  const topModules = modules
    .map(m => ({ slug: m.slug, nameEn: m.nameEn, icon: m.icon, usageCount: m.usageCount, enabled: m.enabled }))
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 8)

  return NextResponse.json({
    totalConversations,
    totalMessages,
    bookmarked,
    moduleUsage,
    dailyActivity,
    topModules,
  })
}
