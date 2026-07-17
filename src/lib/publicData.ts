import { getDb } from '@/lib/db'
import { projects, services, skills, certifications, clients, timelineItems, blogPosts, blogCategories, aboutContent, heroContent, siteSettings } from '@/lib/db/schema'
import { eq, asc, desc, sql, and, inArray } from 'drizzle-orm'

const EXPECTED_POST_COUNT = 150
// Bump this version whenever blog content is updated to force a DB resync
const CONTENT_VERSION = '3'
let _resynced = false

async function autoResyncIfNeeded() {
  if (_resynced) return
  try {
    const db = getDb()
    const result = (await db.select({ count: sql<number>`count(*)` }).from(blogPosts))[0]
    const storedVersion = (await db.select().from(siteSettings).where(eq(siteSettings.key, '_content_version')))[0]
    const needsResync = (result?.count ?? 0) < EXPECTED_POST_COUNT || storedVersion?.value !== CONTENT_VERSION
    if (needsResync) {
      const { resyncPublicContent } = await import('@/lib/db/resync')
      await resyncPublicContent()
      // Store current version to avoid re-running on next request
      const { pgQuery } = await import('@/lib/db')
      await pgQuery(
        "INSERT INTO site_settings (key, value) VALUES ('_content_version', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [CONTENT_VERSION],
      )
      _resynced = true
    } else {
      _resynced = true
    }
  } catch { /* silent */ }
}

export async function getPublicSetting(key: string): Promise<string | null> {
  try {
    const db = getDb()
    const row = (await db.select().from(siteSettings).where(eq(siteSettings.key, key)))[0]
    return row?.value ?? null
  } catch { return null }
}

export async function getPublicHero(locale: string) {
  try {
    const db = getDb()
    return (await db.select().from(heroContent).where(eq(heroContent.locale, locale)))[0] ?? null
  } catch { return null }
}

export async function getPublicAbout(locale: string) {
  try {
    const db = getDb()
    return (await db.select().from(aboutContent).where(eq(aboutContent.locale, locale)))[0] ?? null
  } catch { return null }
}

export async function getPublicProjects() {
  try {
    const db = getDb()
    return await db.select().from(projects).where(eq(projects.active, true)).orderBy(asc(projects.sortOrder))
  } catch { return [] }
}

export async function getPublicServices() {
  try {
    const db = getDb()
    return await db.select().from(services).where(eq(services.active, true)).orderBy(asc(services.sortOrder))
  } catch { return [] }
}

export async function getPublicSkills() {
  try {
    const db = getDb()
    return await db.select().from(skills).where(eq(skills.active, true)).orderBy(asc(skills.sortOrder))
  } catch { return [] }
}

export async function getPublicCerts() {
  try {
    const db = getDb()
    return await db.select().from(certifications).where(eq(certifications.active, true)).orderBy(asc(certifications.sortOrder))
  } catch { return [] }
}

export async function getPublicClients() {
  try {
    const db = getDb()
    return await db.select().from(clients).where(eq(clients.active, true)).orderBy(asc(clients.sortOrder))
  } catch { return [] }
}

export async function getPublicTimeline() {
  try {
    const db = getDb()
    return await db.select().from(timelineItems).where(eq(timelineItems.active, true)).orderBy(asc(timelineItems.sortOrder))
  } catch { return [] }
}

export async function getPublicBlogPosts() {
  try {
    await autoResyncIfNeeded()
    const db = getDb()
    return await db.select().from(blogPosts).where(eq(blogPosts.status, 'published')).orderBy(desc(blogPosts.createdAt))
  } catch { return [] }
}

export async function getPublicBlogCategories() {
  try {
    const db = getDb()
    return await db.select().from(blogCategories).orderBy(asc(blogCategories.sortOrder))
  } catch { return [] }
}

export async function getPublicCaseStudyBySlug(slug: string) {
  try {
    const db = getDb()
    const result = (await db.select().from(projects).where(and(eq(projects.slug, slug), eq(projects.active, true))))[0]
    return result ?? null
  } catch { return null }
}

export async function getPublicRelatedCaseStudies(slugs: string[]) {
  try {
    if (!slugs.length) return []
    const db = getDb()
    return await db.select().from(projects).where(and(inArray(projects.slug, slugs), eq(projects.active, true)))
  } catch { return [] }
}
