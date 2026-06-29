import { getDb } from '@/lib/db'
import { projects, services, skills, certifications, clients, timelineItems, blogPosts, blogCategories, aboutContent, heroContent, siteSettings } from '@/lib/db/schema'
import { eq, asc, desc, sql } from 'drizzle-orm'

const EXPECTED_POST_COUNT = 150
// Bump this version whenever blog content is updated to force a DB resync
const CONTENT_VERSION = '3'
let _resynced = false

async function autoResyncIfNeeded() {
  if (_resynced) return
  try {
    const db = getDb()
    const result = db.select({ count: sql<number>`count(*)` }).from(blogPosts).get()
    const storedVersion = db.select().from(siteSettings).where(eq(siteSettings.key, '_content_version')).get()
    const needsResync = (result?.count ?? 0) < EXPECTED_POST_COUNT || storedVersion?.value !== CONTENT_VERSION
    if (needsResync) {
      const { resyncPublicContent } = await import('@/lib/db/resync')
      resyncPublicContent()
      // Store current version to avoid re-running on next request
      db.$client.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('_content_version', ?)").run(CONTENT_VERSION)
      _resynced = true
    } else {
      _resynced = true
    }
  } catch { /* silent */ }
}

export async function getPublicSetting(key: string): Promise<string | null> {
  try {
    const db = getDb()
    const row = db.select().from(siteSettings).where(eq(siteSettings.key, key)).get()
    return row?.value ?? null
  } catch { return null }
}

export async function getPublicHero(locale: string) {
  try {
    const db = getDb()
    return db.select().from(heroContent).where(eq(heroContent.locale, locale)).get() ?? null
  } catch { return null }
}

export async function getPublicAbout(locale: string) {
  try {
    const db = getDb()
    return db.select().from(aboutContent).where(eq(aboutContent.locale, locale)).get() ?? null
  } catch { return null }
}

export async function getPublicProjects() {
  try {
    const db = getDb()
    return db.select().from(projects).where(eq(projects.active, true)).orderBy(asc(projects.sortOrder)).all()
  } catch { return [] }
}

export async function getPublicServices() {
  try {
    const db = getDb()
    return db.select().from(services).where(eq(services.active, true)).orderBy(asc(services.sortOrder)).all()
  } catch { return [] }
}

export async function getPublicSkills() {
  try {
    const db = getDb()
    return db.select().from(skills).where(eq(skills.active, true)).orderBy(asc(skills.sortOrder)).all()
  } catch { return [] }
}

export async function getPublicCerts() {
  try {
    const db = getDb()
    return db.select().from(certifications).where(eq(certifications.active, true)).orderBy(asc(certifications.sortOrder)).all()
  } catch { return [] }
}

export async function getPublicClients() {
  try {
    const db = getDb()
    return db.select().from(clients).where(eq(clients.active, true)).orderBy(asc(clients.sortOrder)).all()
  } catch { return [] }
}

export async function getPublicTimeline() {
  try {
    const db = getDb()
    return db.select().from(timelineItems).where(eq(timelineItems.active, true)).orderBy(asc(timelineItems.sortOrder)).all()
  } catch { return [] }
}

export async function getPublicBlogPosts() {
  try {
    await autoResyncIfNeeded()
    const db = getDb()
    return db.select().from(blogPosts).where(eq(blogPosts.status, 'published')).orderBy(desc(blogPosts.createdAt)).all()
  } catch { return [] }
}

export async function getPublicBlogCategories() {
  try {
    const db = getDb()
    return db.select().from(blogCategories).orderBy(asc(blogCategories.sortOrder)).all()
  } catch { return [] }
}
