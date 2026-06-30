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
  totpSecret: text('totp_secret'),
  totpEnabled: integer('totp_enabled', { mode: 'boolean' }).notNull().default(false),
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
  executiveSummaryEn: text('executive_summary_en'),
  executiveSummaryFa: text('executive_summary_fa'),
  existingInfraEn: text('existing_infra_en'),
  existingInfraFa: text('existing_infra_fa'),
  proposedArchEn: text('proposed_arch_en'),
  proposedArchFa: text('proposed_arch_fa'),
  techStackJson: text('tech_stack_json'),
  implementationTimelineJson: text('implementation_timeline_json'),
  lessonsLearnedEn: text('lessons_learned_en'),
  lessonsLearnedFa: text('lessons_learned_fa'),
  futureImprovementsEn: text('future_improvements_en'),
  futureImprovementsFa: text('future_improvements_fa'),
  businessScopeEn: text('business_scope_en'),
  businessScopeFa: text('business_scope_fa'),
  collaborationType: text('collaboration_type'),
  projectStatus: text('project_status').default('completed'),
  isConfidential: integer('is_confidential', { mode: 'boolean' }).notNull().default(false),
  networkDiagramUrl: text('network_diagram_url'),
  infraDiagramUrl: text('infra_diagram_url'),
  downloadPdfUrl: text('download_pdf_url'),
  downloadArchUrl: text('download_arch_url'),
  downloadTechSummaryUrl: text('download_tech_summary_url'),
  clientLogoUrl: text('client_logo_url'),
  technologyFilters: text('technology_filters'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  seoKeywords: text('seo_keywords'),
  ogImage: text('og_image'),
  haAvailabilityEn: text('ha_availability_en'),
  haAvailabilityFa: text('ha_availability_fa'),
  backupStrategyEn: text('backup_strategy_en'),
  backupStrategyFa: text('backup_strategy_fa'),
  disasterRecoveryEn: text('disaster_recovery_en'),
  disasterRecoveryFa: text('disaster_recovery_fa'),
  monitoringStrategyEn: text('monitoring_strategy_en'),
  monitoringStrategyFa: text('monitoring_strategy_fa'),
  securityConsiderationsEn: text('security_considerations_en'),
  securityConsiderationsFa: text('security_considerations_fa'),
  deploymentProcessEn: text('deployment_process_en'),
  deploymentProcessFa: text('deployment_process_fa'),
  beforeAfterJson: text('before_after_json'),
  businessImpactJson: text('business_impact_json'),
  relatedTags: text('related_tags'),
  relatedCaseStudySlugs: text('related_case_study_slugs'),
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
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
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

// ─── Forms ────────────────────────────────────────────────────────────────────

export const forms = sqliteTable('forms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  type: text('type', { enum: ['contact', 'consultation', 'newsletter', 'custom'] }).notNull().default('contact'),
  fieldsJson: text('fields_json').notNull().default('[]'),
  settingsJson: text('settings_json').notNull().default('{}'),
  emailTo: text('email_to'),
  emailSubject: text('email_subject'),
  successMessageEn: text('success_message_en'),
  successMessageFa: text('success_message_fa'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  submissionsCount: integer('submissions_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  createdBy: text('created_by').references(() => users.id),
})

export type Form = typeof forms.$inferSelect

// ─── AI Platform ─────────────────────────────────────────────────────────────

export const aiModules = sqliteTable('ai_modules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  descriptionEn: text('description_en'),
  descriptionFa: text('description_fa'),
  icon: text('icon').notNull().default('🤖'),
  category: text('category').notNull().default('general'),
  systemPrompt: text('system_prompt'),
  color: text('color').notNull().default('indigo'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const aiConversations = sqliteTable('ai_conversations', {
  id: text('id').primaryKey(),
  moduleSlug: text('module_slug'),
  titleEn: text('title_en'),
  locale: text('locale').notNull().default('en'),
  messagesJson: text('messages_json').notNull().default('[]'),
  sourcesJson: text('sources_json').notNull().default('[]'),
  bookmarked: integer('bookmarked', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ─── Redirects ────────────────────────────────────────────────────────────────

export const redirects = sqliteTable('redirects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fromPath: text('from_path').notNull().unique(),
  toPath: text('to_path').notNull(),
  statusCode: integer('status_code').notNull().default(301),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  hits: integer('hits').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export type Redirect = typeof redirects.$inferSelect

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

// ─── Section Builder ──────────────────────────────────────────────────────────

export const sections = sqliteTable('sections', {
  id: text('id').primaryKey(),
  sectionType: text('section_type').notNull(),
  variant: text('variant').notNull().default('default'),
  titleEn: text('title_en'),
  titleFa: text('title_fa'),
  subtitleEn: text('subtitle_en'),
  subtitleFa: text('subtitle_fa'),
  contentEn: text('content_en'),
  contentFa: text('content_fa'),
  theme: text('theme').notNull().default('dark'),
  bgColor: text('bg_color'),
  bgImage: text('bg_image'),
  bgOverlay: real('bg_overlay').default(0),
  mediaUrl: text('media_url'),
  mediaAlt: text('media_alt'),
  animationIn: text('animation_in').default('fade'),
  visibilityRules: text('visibility_rules'),
  responsiveConfig: text('responsive_config'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  extraData: text('extra_data'),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  scheduledAt: text('scheduled_at'),
  archivedAt: text('archived_at'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
})

export const sectionVersions = sqliteTable('section_versions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sectionId: text('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  snapshot: text('snapshot').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  createdBy: text('created_by').references(() => users.id),
})

export const pages = sqliteTable('pages', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleFa: text('title_fa').notNull(),
  descriptionEn: text('description_en'),
  descriptionFa: text('description_fa'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  ogImage: text('og_image'),
  layout: text('layout').notNull().default('default'),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  publishedAt: text('published_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
})

export const pageSections = sqliteTable('page_sections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pageId: text('page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  sectionId: text('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
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
export type Section = typeof sections.$inferSelect
export type SectionVersion = typeof sectionVersions.$inferSelect
export type Page = typeof pages.$inferSelect
export type PageSection = typeof pageSections.$inferSelect
export type AiModule = typeof aiModules.$inferSelect
export type AiConversation = typeof aiConversations.$inferSelect
