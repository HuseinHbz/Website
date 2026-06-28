import { getDb } from '@/lib/db'
import { projects, services, skills, certifications, clients, timelineItems, blogPosts, blogCategories, aboutContent } from '@/lib/db/schema'
import { eq, asc, desc } from 'drizzle-orm'

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
