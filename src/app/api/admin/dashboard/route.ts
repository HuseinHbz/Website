import { NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { analyticsEvents, contactRequests, consultationRequests, blogPosts, projects, services, auditLogs } from '@/lib/db/schema'
import { sql, eq, gte, desc } from 'drizzle-orm'

export async function GET() {
  const auth = await requirePermission('executive.dashboard', 'read')
  if ('error' in auth) return auth.error
  try {
  const db = getDb()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    totalViews,
    weeklyViews,
    newContacts,
    newConsultations,
    publishedPosts,
    activeProjects,
    activeServices,
    recentLogs,
    dailyViews,
    topPages,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(analyticsEvents).where(eq(analyticsEvents.type, 'pageview')).then(r => r[0]),
    db.select({ count: sql<number>`count(*)` }).from(analyticsEvents).where(
      sql`type = 'pageview' AND created_at >= ${sevenDaysAgo}`
    ).then(r => r[0]),
    db.select({ count: sql<number>`count(*)` }).from(contactRequests).where(
      sql`status = 'new' AND created_at >= ${thirtyDaysAgo}`
    ).then(r => r[0]),
    db.select({ count: sql<number>`count(*)` }).from(consultationRequests).where(
      sql`status = 'new' AND created_at >= ${thirtyDaysAgo}`
    ).then(r => r[0]),
    db.select({ count: sql<number>`count(*)` }).from(blogPosts).where(eq(blogPosts.status, 'published')).then(r => r[0]),
    db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.active, true)).then(r => r[0]),
    db.select({ count: sql<number>`count(*)` }).from(services).where(eq(services.active, true)).then(r => r[0]),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(10),
    db.select({
      date: sql<string>`date(created_at)`,
      count: sql<number>`count(*)`,
    }).from(analyticsEvents).where(
      sql`type = 'pageview' AND created_at >= ${thirtyDaysAgo}`
    ).groupBy(sql`date(created_at)`).orderBy(sql`date(created_at)`),
    db.select({
      page: analyticsEvents.page,
      count: sql<number>`count(*)`,
    }).from(analyticsEvents).where(
      sql`type = 'pageview' AND created_at >= ${thirtyDaysAgo}`
    ).groupBy(analyticsEvents.page).orderBy(sql`count(*) DESC`).limit(10),
  ])

  return NextResponse.json({
    stats: {
      totalViews: totalViews?.count ?? 0,
      weeklyViews: weeklyViews?.count ?? 0,
      newContacts: newContacts?.count ?? 0,
      newConsultations: newConsultations?.count ?? 0,
      publishedPosts: publishedPosts?.count ?? 0,
      activeProjects: activeProjects?.count ?? 0,
      activeServices: activeServices?.count ?? 0,
    },
    dailyViews,
    topPages,
    recentActivity: recentLogs,
  })
  } catch (e: unknown) {
    return apiError(e)
  }
}
