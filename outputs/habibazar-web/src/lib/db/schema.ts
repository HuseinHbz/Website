import { sql } from 'drizzle-orm'
import {
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

// ─── Users & Auth ────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['super_admin', 'administrator', 'editor'] }).notNull().default('editor'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  avatar: text('avatar'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  lastLogin: text('last_login'),
})

export const adminSessions = sqliteTable('admin_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
})

// ─── Site Settings ───────────────────────────────────────────────────────────

export const siteSettings = sqliteTable('site_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
  group: text('group').notNull().default('general'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── SEO Settings ────────────────────────────────────────────────────────────

export const seoSettings = sqliteTable('seo_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pageKey: text('page_key').notNull(),
  locale: text('locale').notNull().default('en'),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  keywords: text('keywords'),
  ogTitle: text('og_title'),
  ogDescription: text('og_description'),
  ogImage: text('og_image'),
  schemaMarkup: text('schema_markup'),
  canonicalUrl: text('canonical_url'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Hero Content ─────────────────────────────────────────────────────────────

export const heroContent = sqliteTable('hero_content', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  locale: text('locale').notNull().default('en'),
  badge: text('badge'),
  headline: text('headline'),
  headlineHighlight: text('headline_highlight'),
  subheadline: text('subheadline'),
  ctaPrimary: text('cta_primary'),
  ctaPrimaryHref: text('cta_primary_href'),
  ctaSecondary: text('cta_secondary'),
  ctaSecondaryHref: text('cta_secondary_href'),
  ctaTertiary: text('cta_tertiary'),
  ctaTertiaryHref: text('cta_tertiary_href'),
  stat1Label: text('stat1_label'),
  stat1Value: text('stat1_value'),
  stat2Label: text('stat2_label'),
  stat2Value: text('stat2_value'),
  stat3Label: text('stat3_label'),
  stat3Value: text('stat3_value'),
  stat4Label: text('stat4_label'),
  stat4Value: text('stat4_value'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── About Content ───────────────────────────────────────────────────────────

export const aboutContent = sqliteTable('about_content', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  locale: text('locale').notNull().default('en'),
  headline: text('headline'),
  subheadline: text('subheadline'),
  bio: text('bio'),
  photoUrl: text('photo_url'),
  resumeUrl: text('resume_url'),
  yearsExp: text('years_exp'),
  projectsCount: text('projects_count'),
  endpointsCount: text('endpoints_count'),
  deploymentsCount: text('deployments_count'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Timeline (Career Path) ───────────────────────────────────────────────────

export const timelineItems = sqliteTable('timeline_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  year: text('year').notNull(),
  titleEn: text('title_en').notNull(),
  titleFa: text('title_fa').notNull(),
  companyEn: text('company_en'),
  companyFa: text('company_fa'),
  descEn: text('desc_en'),
  descFa: text('desc_fa'),
  color: text('color').default('#6366f1'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Skills ───────────────────────────────────────────────────────────────────

export const skills = sqliteTable('skills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  categoryEn: text('category_en').notNull(),
  categoryFa: text('category_fa').notNull(),
  level: integer('level').notNull().default(80),
  icon: text('icon'),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Certifications ──────────────────────────────────────────────────────────

export const certifications = sqliteTable('certifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  issuer: text('issuer'),
  issueDate: text('issue_date'),
  expiryDate: text('expiry_date'),
  credentialId: text('credential_id'),
  credentialUrl: text('credential_url'),
  badgeUrl: text('badge_url'),
  color: text('color').default('#6366f1'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Services ─────────────────────────────────────────────────────────────────

export const services = sqliteTable('services', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleFa: text('title_fa').notNull(),
  categoryEn: text('category_en').notNull(),
  categoryFa: text('category_fa').notNull(),
  shortDescEn: text('short_desc_en'),
  shortDescFa: text('short_desc_fa'),
  longDescEn: text('long_desc_en'),
  longDescFa: text('long_desc_fa'),
  featuresEn: text('features_en'),
  featuresFa: text('features_fa'),
  icon: text('icon'),
  color: text('color').default('#6366f1'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  industryEn: text('industry_en'),
  industryFa: text('industry_fa'),
  clientEn: text('client_en'),
  clientFa: text('client_fa'),
  challengeEn: text('challenge_en'),
  challengeFa: text('challenge_fa'),
  solutionEn: text('solution_en'),
  solutionFa: text('solution_fa'),
  resultsEn: text('results_en'),
  resultsFa: text('results_fa'),
  tagsEn: text('tags_en'),
  tagsFa: text('tags_fa'),
  coverImage: text('cover_image'),
  gallery: text('gallery'),
  color: text('color').default('#6366f1'),
  year: text('year'),
  duration: text('duration'),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Clients / Companies ──────────────────────────────────────────────────────

export const clients = sqliteTable('clients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  typeEn: text('type_en'),
  typeFa: text('type_fa'),
  logoUrl: text('logo_url'),
  website: text('website'),
  isTechPartner: integer('is_tech_partner', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Blog Categories ──────────────────────────────────────────────────────────

export const blogCategories = sqliteTable('blog_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  icon: text('icon'),
  color: text('color').default('#6366f1'),
  sortOrder: integer('sort_order').notNull().default(0),
})

// ─── Blog Posts ───────────────────────────────────────────────────────────────

export const blogPosts = sqliteTable('blog_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleFa: text('title_fa').notNull(),
  excerptEn: text('excerpt_en'),
  excerptFa: text('excerpt_fa'),
  contentEn: text('content_en'),
  contentFa: text('content_fa'),
  categoryId: integer('category_id').references(() => blogCategories.id),
  coverImage: text('cover_image'),
  readTimeEn: text('read_time_en'),
  readTimeFa: text('read_time_fa'),
  publishedAtEn: text('published_at_en'),
  publishedAtFa: text('published_at_fa'),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  views: integer('views').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Navigation ───────────────────────────────────────────────────────────────

export const navigationItems = sqliteTable('navigation_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  labelEn: text('label_en').notNull(),
  labelFa: text('label_fa').notNull(),
  href: text('href').notNull(),
  icon: text('icon'),
  location: text('location', { enum: ['header', 'footer'] }).notNull().default('header'),
  parentId: integer('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ─── Media Files ──────────────────────────────────────────────────────────────

export const mediaFiles = sqliteTable('media_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  url: text('url').notNull(),
  folder: text('folder').default('general'),
  alt: text('alt'),
  caption: text('caption'),
  uploadedAt: text('uploaded_at').notNull().default(sql`(datetime('now'))`),
  uploadedBy: text('uploaded_by').references(() => users.id),
})

// ─── AI Knowledge Base ────────────────────────────────────────────────────────

export const aiKnowledgeBase = sqliteTable('ai_knowledge_base', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  type: text('type', { enum: ['document', 'faq', 'snippet', 'url'] }).notNull().default('document'),
  content: text('content'),
  fileUrl: text('file_url'),
  sourceUrl: text('source_url'),
  tags: text('tags'),
  locale: text('locale').default('both'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  priority: integer('priority').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Contact Requests ─────────────────────────────────────────────────────────

export const contactRequests = sqliteTable('contact_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  company: text('company'),
  subject: text('subject'),
  message: text('message').notNull(),
  status: text('status', { enum: ['new', 'read', 'replied', 'archived'] }).notNull().default('new'),
  ipAddress: text('ip_address'),
  locale: text('locale').default('en'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ─── Consultation Requests ────────────────────────────────────────────────────

export const consultationRequests = sqliteTable('consultation_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  company: text('company'),
  serviceInterest: text('service_interest'),
  projectDescription: text('project_description'),
  budget: text('budget'),
  timeline: text('timeline'),
  preferredDate: text('preferred_date'),
  preferredTime: text('preferred_time'),
  type: text('type', { enum: ['intro', 'full', 'technical'] }).default('full'),
  status: text('status', { enum: ['new', 'scheduled', 'completed', 'cancelled'] }).notNull().default('new'),
  notes: text('notes'),
  ipAddress: text('ip_address'),
  locale: text('locale').default('en'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ─── Analytics Events ─────────────────────────────────────────────────────────

export const analyticsEvents = sqliteTable('analytics_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  page: text('page'),
  referrer: text('referrer'),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  locale: text('locale'),
  sessionId: text('session_id'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type SiteSetting = typeof siteSettings.$inferSelect
export type HeroContent = typeof heroContent.$inferSelect
export type TimelineItem = typeof timelineItems.$inferSelect
export type Skill = typeof skills.$inferSelect
export type Certification = typeof certifications.$inferSelect
export type Service = typeof services.$inferSelect
export type Project = typeof projects.$inferSelect
export type Client = typeof clients.$inferSelect
export type BlogCategory = typeof blogCategories.$inferSelect
export type BlogPost = typeof blogPosts.$inferSelect
export type MediaFile = typeof mediaFiles.$inferSelect
export type AiKnowledgeItem = typeof aiKnowledgeBase.$inferSelect
export type ContactRequest = typeof contactRequests.$inferSelect
export type ConsultationRequest = typeof consultationRequests.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect
