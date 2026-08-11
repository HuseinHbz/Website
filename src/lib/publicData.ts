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


/**
 * 26.29 BUG-114 — "deactivated means deactivated".
 *
 * The homepage sections fell back to hardcoded demo arrays whenever the DB
 * returned an empty list. Deactivating every client therefore made ALL the
 * built-in demo clients appear — the operator's action produced the opposite
 * of what they asked for.
 *
 * Fix: distinguish the two empty cases.
 *   • table has NO rows at all  → `null`  = never configured, demo content is
 *     still a reasonable first-run experience for a brochure site
 *   • table has rows, none active → `[]`  = a deliberate choice; render the
 *     empty state and show NOTHING
 * Callers fall back to demo data only on `null`.
 */
async function activeOrNull<T>(
  loadActive: () => Promise<T[]>,
  countAll: () => Promise<number>,
): Promise<T[] | null> {
  const rows = await loadActive()
  if (rows.length > 0) return rows
  return (await countAll()) > 0 ? [] : null
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
    return await activeOrNull(
      () => db.select().from(projects).where(eq(projects.active, true)).orderBy(asc(projects.sortOrder)),
      async () => Number((await db.select({ c: sql<number>`count(*)` }).from(projects))[0]?.c ?? 0),
    )
  } catch { return null }
}

export async function getPublicServices() {
  try {
    const db = getDb()
    return await activeOrNull(
      () => db.select().from(services).where(eq(services.active, true)).orderBy(asc(services.sortOrder)),
      async () => Number((await db.select({ c: sql<number>`count(*)` }).from(services))[0]?.c ?? 0),
    )
  } catch { return null }
}

export async function getPublicSkills() {
  try {
    const db = getDb()
    return await activeOrNull(
      () => db.select().from(skills).where(eq(skills.active, true)).orderBy(asc(skills.sortOrder)),
      async () => Number((await db.select({ c: sql<number>`count(*)` }).from(skills))[0]?.c ?? 0),
    )
  } catch { return null }
}

export async function getPublicCerts() {
  try {
    const db = getDb()
    return await activeOrNull(
      () => db.select().from(certifications).where(eq(certifications.active, true)).orderBy(asc(certifications.sortOrder)),
      async () => Number((await db.select({ c: sql<number>`count(*)` }).from(certifications))[0]?.c ?? 0),
    )
  } catch { return null }
}

export async function getPublicClients() {
  try {
    const db = getDb()
    return await activeOrNull(
      () => db.select().from(clients).where(eq(clients.active, true)).orderBy(asc(clients.sortOrder)),
      async () => Number((await db.select({ c: sql<number>`count(*)` }).from(clients))[0]?.c ?? 0),
    )
  } catch { return null }
}

/**
 * 26.29 BUG-116 — professional credentials (CCNA, LPIC, VCP …) are managed at
 * /admin/credentials but were never surfaced anywhere on the public site.
 * Distinct from `certifications` (organizational certificates, بند ۳).
 * No demo fallback: an empty list simply renders nothing.
 */
export async function getPublicCredentials() {
  try {
    const { credentials } = await import('@/lib/db/schema')
    const db = getDb()
    return await db.select().from(credentials)
      .where(eq(credentials.active, true))
      .orderBy(asc(credentials.sortOrder))
  } catch { return [] }
}

/**
 * 26.31 بند ۵ — testimonials were rendered ONLY inside /solutions/[slug], i.e.
 * hidden behind a page that was itself missing from the menu (double-hidden).
 * This exposes the featured/active ones for the homepage trust section.
 * Empty result → the section renders nothing (26.29 rule 22); no demo fallback.
 */
export async function getPublicTestimonials(limit = 6) {
  try {
    const { testimonials } = await import('@/lib/db/schema')
    const db = getDb()
    return await db.select().from(testimonials)
      .where(eq(testimonials.active, true))
      .orderBy(asc(testimonials.sortOrder))
      .limit(limit)
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

/**
 * SEO fix — every blog post used to inherit the homepage's title/
 * description/canonical/OG image (the [slug] page was 'use client' with no
 * `generateMetadata`, which only a server component can export). This is
 * the server-side lookup that makes a real per-post `generateMetadata`
 * possible, mirroring `getPublicCaseStudyBySlug`'s shape/error handling.
 */
export async function getPublicBlogPostBySlug(slug: string) {
  try {
    await autoResyncIfNeeded()
    const db = getDb()
    const row = (await db.select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      titleEn: blogPosts.titleEn,
      titleFa: blogPosts.titleFa,
      excerptEn: blogPosts.excerptEn,
      excerptFa: blogPosts.excerptFa,
      contentEn: blogPosts.contentEn,
      contentFa: blogPosts.contentFa,
      coverImage: blogPosts.coverImage,
      readTimeEn: blogPosts.readTimeEn,
      readTimeFa: blogPosts.readTimeFa,
      publishedAtEn: blogPosts.publishedAtEn,
      publishedAtFa: blogPosts.publishedAtFa,
      categoryId: blogPosts.categoryId,
      categoryNameEn: blogCategories.nameEn,
      categoryNameFa: blogCategories.nameFa,
      categoryColor: blogCategories.color,
      createdAt: blogPosts.createdAt,
      updatedAt: blogPosts.updatedAt,
    }).from(blogPosts)
      .leftJoin(blogCategories, eq(blogCategories.id, blogPosts.categoryId))
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published'))))[0]
    return row ?? null
  } catch { return null }
}

/** Prev/next navigation for a published post, ordered by id (matches the
 *  existing `/api/blog/[slug]` behavior — kept identical so both the page
 *  and the API agree on adjacency). */
export async function getPublicBlogPostNav(id: number) {
  try {
    const db = getDb()
    const [prev, next] = await Promise.all([
      db.select({ slug: blogPosts.slug, titleEn: blogPosts.titleEn, titleFa: blogPosts.titleFa })
        .from(blogPosts).where(and(eq(blogPosts.status, 'published'), sql`${blogPosts.id} < ${id}`))
        .orderBy(desc(blogPosts.id)).limit(1),
      db.select({ slug: blogPosts.slug, titleEn: blogPosts.titleEn, titleFa: blogPosts.titleFa })
        .from(blogPosts).where(and(eq(blogPosts.status, 'published'), sql`${blogPosts.id} > ${id}`))
        .orderBy(asc(blogPosts.id)).limit(1),
    ])
    return { prev: prev[0] ?? null, next: next[0] ?? null }
  } catch { return { prev: null, next: null } }
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
