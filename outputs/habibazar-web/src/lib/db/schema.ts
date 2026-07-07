import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
} from 'drizzle-orm/pg-core'

// Client-side timestamp default ('YYYY-MM-DD HH24:MI:SS') so inserts never rely
// on a DB-level default — resilient to how the table was created.
const tsNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

// ─── Users & Auth ────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['super_admin', 'administrator', 'editor'] }).notNull().default('editor'),
  department: text('department'),
  active: boolean('active').notNull().default(true),
  avatar: text('avatar'),
  totpSecret: text('totp_secret'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  lastLogin: text('last_login'),
})

export const adminSessions = pgTable('admin_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
})

// ─── Site Settings ───────────────────────────────────────────────────────────

export const siteSettings = pgTable('site_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value'),
  group: text('group').notNull().default('general'),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── SEO Settings ────────────────────────────────────────────────────────────

export const seoSettings = pgTable('seo_settings', {
  id: serial('id').primaryKey(),
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
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Hero Content ─────────────────────────────────────────────────────────────

export const heroContent = pgTable('hero_content', {
  id: serial('id').primaryKey(),
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
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── About Content ───────────────────────────────────────────────────────────

export const aboutContent = pgTable('about_content', {
  id: serial('id').primaryKey(),
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
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Timeline (Career Path) ───────────────────────────────────────────────────

export const timelineItems = pgTable('timeline_items', {
  id: serial('id').primaryKey(),
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
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Skills ───────────────────────────────────────────────────────────────────

export const skills = pgTable('skills', {
  id: serial('id').primaryKey(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  categoryEn: text('category_en').notNull(),
  categoryFa: text('category_fa').notNull(),
  level: integer('level').notNull().default(80),
  icon: text('icon'),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Certifications ──────────────────────────────────────────────────────────

export const certifications = pgTable('certifications', {
  id: serial('id').primaryKey(),
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
  active: boolean('active').notNull().default(true),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Services ─────────────────────────────────────────────────────────────────

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
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
  active: boolean('active').notNull().default(true),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
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
  isConfidential: boolean('is_confidential').notNull().default(false),
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
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Clients / Companies ──────────────────────────────────────────────────────

export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  typeEn: text('type_en'),
  typeFa: text('type_fa'),
  logoUrl: text('logo_url'),
  website: text('website'),
  isTechPartner: boolean('is_tech_partner').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Blog Categories ──────────────────────────────────────────────────────────

export const blogCategories = pgTable('blog_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  icon: text('icon'),
  color: text('color').default('#6366f1'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

// ─── Blog Posts ───────────────────────────────────────────────────────────────

export const blogPosts = pgTable('blog_posts', {
  id: serial('id').primaryKey(),
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
  featured: boolean('featured').notNull().default(false),
  views: integer('views').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Navigation ───────────────────────────────────────────────────────────────

export const navigationItems = pgTable('navigation_items', {
  id: serial('id').primaryKey(),
  labelEn: text('label_en').notNull(),
  labelFa: text('label_fa').notNull(),
  href: text('href').notNull(),
  icon: text('icon'),
  location: text('location', { enum: ['header', 'footer'] }).notNull().default('header'),
  parentId: integer('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
})

// ─── Media Files ──────────────────────────────────────────────────────────────

export const mediaFiles = pgTable('media_files', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  url: text('url').notNull(),
  folder: text('folder').default('general'),
  alt: text('alt'),
  caption: text('caption'),
  uploadedAt: text('uploaded_at').notNull().$defaultFn(tsNow),
  uploadedBy: text('uploaded_by').references(() => users.id),
})

// ─── AI Knowledge Base ────────────────────────────────────────────────────────

export const aiKnowledgeBase = pgTable('ai_knowledge_base', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type', { enum: ['document', 'faq', 'snippet', 'url'] }).notNull().default('document'),
  content: text('content'),
  fileUrl: text('file_url'),
  sourceUrl: text('source_url'),
  tags: text('tags'),
  locale: text('locale').default('both'),
  active: boolean('active').notNull().default(true),
  priority: integer('priority').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

// ─── Forms ────────────────────────────────────────────────────────────────────

export const forms = pgTable('forms', {
  id: serial('id').primaryKey(),
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
  active: boolean('active').notNull().default(true),
  submissionsCount: integer('submissions_count').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  createdBy: text('created_by').references(() => users.id),
})

export type Form = typeof forms.$inferSelect

// ─── AI Platform ─────────────────────────────────────────────────────────────

export const aiModules = pgTable('ai_modules', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  descriptionEn: text('description_en'),
  descriptionFa: text('description_fa'),
  icon: text('icon').notNull().default('🤖'),
  category: text('category').notNull().default('general'),
  systemPrompt: text('system_prompt'),
  color: text('color').notNull().default('indigo'),
  enabled: boolean('enabled').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
})

export const aiConversations = pgTable('ai_conversations', {
  id: text('id').primaryKey(),
  moduleSlug: text('module_slug'),
  titleEn: text('title_en'),
  locale: text('locale').notNull().default('en'),
  messagesJson: text('messages_json').notNull().default('[]'),
  sourcesJson: text('sources_json').notNull().default('[]'),
  bookmarked: boolean('bookmarked').notNull().default(false),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
})

// ─── Solutions (Phase 6) ──────────────────────────────────────────────────────

export const solutions = pgTable('solutions', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  taglineEn: text('tagline_en'),
  taglineFa: text('tagline_fa'),
  descriptionEn: text('description_en'),
  descriptionFa: text('description_fa'),
  icon: text('icon').notNull().default('🔧'),
  color: text('color').notNull().default('#6366f1'),
  challengesJson: text('challenges_json').notNull().default('[]'),
  approachJson: text('approach_json').notNull().default('[]'),
  benefitsJson: text('benefits_json').notNull().default('[]'),
  techStackJson: text('tech_stack_json').notNull().default('[]'),
  roadmapJson: text('roadmap_json').notNull().default('[]'),
  faqJson: text('faq_json').notNull().default('[]'),
  metricsJson: text('metrics_json').notNull().default('[]'),
  relatedCaseStudySlugs: text('related_case_study_slugs'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  seoKeywords: text('seo_keywords'),
  ogImage: text('og_image'),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

export type Solution = typeof solutions.$inferSelect

export const industries = pgTable('industries', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  taglineEn: text('tagline_en'),
  taglineFa: text('tagline_fa'),
  descriptionEn: text('description_en'),
  descriptionFa: text('description_fa'),
  icon: text('icon').notNull().default('🏢'),
  color: text('color').notNull().default('#6366f1'),
  challengesJson: text('challenges_json').notNull().default('[]'),
  solutionsJson: text('solutions_json').notNull().default('[]'),
  benefitsJson: text('benefits_json').notNull().default('[]'),
  relatedSolutionSlugs: text('related_solution_slugs'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
})

export type Industry = typeof industries.$inferSelect

export const technologies = pgTable('technologies', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  category: text('category').notNull().default('general'),
  icon: text('icon').notNull().default('⚙️'),
  color: text('color').notNull().default('#6366f1'),
  vendor: text('vendor'),
  descriptionEn: text('description_en'),
  descriptionFa: text('description_fa'),
  logoUrl: text('logo_url'),
  tier: text('tier', { enum: ['core', 'advanced', 'specialized'] }).notNull().default('core'),
  certifications: text('certifications'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
})

export type Technology = typeof technologies.$inferSelect

export const testimonials = pgTable('testimonials', {
  id: serial('id').primaryKey(),
  clientName: text('client_name').notNull(),
  clientTitle: text('client_title'),
  clientCompany: text('client_company'),
  clientAvatar: text('client_avatar'),
  quoteEn: text('quote_en').notNull(),
  quoteFa: text('quote_fa'),
  rating: integer('rating').notNull().default(5),
  projectSlug: text('project_slug'),
  solutionSlug: text('solution_slug'),
  featured: boolean('featured').notNull().default(false),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
})

export type Testimonial = typeof testimonials.$inferSelect

export const pageTemplates = pgTable('page_templates', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  descriptionEn: text('description_en'),
  category: text('category').notNull().default('general'),
  sectionsJson: text('sections_json').notNull().default('[]'),
  defaultPropsJson: text('default_props_json').notNull().default('{}'),
  previewImage: text('preview_image'),
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
})

export type PageTemplate = typeof pageTemplates.$inferSelect

// ─── Redirects ────────────────────────────────────────────────────────────────

export const redirects = pgTable('redirects', {
  id: serial('id').primaryKey(),
  fromPath: text('from_path').notNull().unique(),
  toPath: text('to_path').notNull(),
  statusCode: integer('status_code').notNull().default(301),
  active: boolean('active').notNull().default(true),
  hits: integer('hits').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
})

export type Redirect = typeof redirects.$inferSelect

// ─── Contact Requests ─────────────────────────────────────────────────────────

export const contactRequests = pgTable('contact_requests', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  company: text('company'),
  subject: text('subject'),
  message: text('message').notNull(),
  status: text('status', { enum: ['new', 'read', 'replied', 'archived'] }).notNull().default('new'),
  ipAddress: text('ip_address'),
  locale: text('locale').default('en'),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
})

// ─── Consultation Requests ────────────────────────────────────────────────────

export const consultationRequests = pgTable('consultation_requests', {
  id: serial('id').primaryKey(),
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
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
})

// ─── Analytics Events ─────────────────────────────────────────────────────────

export const analyticsEvents = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  page: text('page'),
  referrer: text('referrer'),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  locale: text('locale'),
  sessionId: text('session_id'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
})

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
})

// ─── Section Builder ──────────────────────────────────────────────────────────

export const sections = pgTable('sections', {
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
  bgOverlay: doublePrecision('bg_overlay').default(0),
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
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
})

export const sectionVersions = pgTable('section_versions', {
  id: serial('id').primaryKey(),
  sectionId: text('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  snapshot: text('snapshot').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  createdBy: text('created_by').references(() => users.id),
})

export const pages = pgTable('pages', {
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
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
})

export const pageSections = pgTable('page_sections', {
  id: serial('id').primaryKey(),
  pageId: text('page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  sectionId: text('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
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

// ─── Phase 7: Multi-Site & Workspace Management ───────────────────────────────

export const sites = pgTable('sites', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  domain: text('domain'),
  altDomains: text('alt_domains'),
  status: text('status', { enum: ['active', 'staging', 'archived', 'maintenance'] }).notNull().default('staging'),
  type: text('type', { enum: ['personal', 'corporate', 'academy', 'docs', 'support', 'portal', 'partner', 'developer', 'status'] }).notNull().default('corporate'),
  themeId: text('theme_id'),
  defaultLocale: text('default_locale').notNull().default('en'),
  supportedLocales: text('supported_locales').notNull().default('en,fa'),
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  homePageSlug: text('home_page_slug'),
  configJson: text('config_json').notNull().default('{}'),
  seoJson: text('seo_json').notNull().default('{}'),
  shareMedia: boolean('share_media').notNull().default(true),
  shareTemplates: boolean('share_templates').notNull().default(true),
  shareKb: boolean('share_kb').notNull().default(false),
  shareUsers: boolean('share_users').notNull().default(false),
  workspaceId: text('workspace_id'),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  createdBy: text('created_by').references(() => users.id),
})

export type Site = typeof sites.$inferSelect

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  type: text('type', { enum: ['personal', 'corporate', 'academy', 'docs', 'support', 'customer', 'partner', 'developer'] }).notNull().default('corporate'),
  icon: text('icon').notNull().default('🏢'),
  color: text('color').notNull().default('#6366f1'),
  descriptionEn: text('description_en'),
  configJson: text('config_json').notNull().default('{}'),
  isolationLevel: text('isolation_level', { enum: ['shared', 'isolated', 'partial'] }).notNull().default('partial'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  createdBy: text('created_by').references(() => users.id),
})

export type Workspace = typeof workspaces.$inferSelect

// ─── Phase 7: Organization Management ────────────────────────────────────────

export const organization = pgTable('organization', {
  id: serial('id').primaryKey(),
  legalNameEn: text('legal_name_en').notNull().default('HBZ Technology'),
  legalNameFa: text('legal_name_fa').notNull().default('فناوری HBZ'),
  brandNameEn: text('brand_name_en').notNull().default('HBZ Technology'),
  brandNameFa: text('brand_name_fa').notNull().default('فناوری HBZ'),
  taglineEn: text('tagline_en'),
  taglineFa: text('tagline_fa'),
  missionEn: text('mission_en'),
  missionFa: text('mission_fa'),
  logoUrl: text('logo_url'),
  logoMarkUrl: text('logo_mark_url'),
  primaryColor: text('primary_color').default('#6366f1'),
  secondaryColor: text('secondary_color').default('#06b6d4'),
  website: text('website'),
  email: text('email'),
  phone: text('phone'),
  addressJson: text('address_json').default('{}'),
  socialJson: text('social_json').default('{}'),
  legalJson: text('legal_json').default('{}'),
  businessUnitsJson: text('business_units_json').default('[]'),
  certificationsJson: text('certifications_json').default('[]'),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  icon: text('icon').notNull().default('🏢'),
  headUserId: text('head_user_id').references(() => users.id),
  parentId: integer('parent_id'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const officeLocations = pgTable('office_locations', {
  id: serial('id').primaryKey(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  type: text('type', { enum: ['hq', 'branch', 'remote', 'partner'] }).notNull().default('branch'),
  city: text('city'),
  country: text('country'),
  addressEn: text('address_en'),
  phone: text('phone'),
  email: text('email'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
})

// ─── Phase 7: Product Platform ────────────────────────────────────────────────

export const productCategories = pgTable('product_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  icon: text('icon').notNull().default('📦'),
  color: text('color').notNull().default('#6366f1'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  taglineEn: text('tagline_en'),
  taglineFa: text('tagline_fa'),
  descriptionEn: text('description_en'),
  descriptionFa: text('description_fa'),
  type: text('type', { enum: ['software', 'service', 'subscription', 'license', 'hardware', 'saas'] }).notNull().default('service'),
  categoryId: integer('category_id').references(() => productCategories.id),
  icon: text('icon').notNull().default('📦'),
  logoUrl: text('logo_url'),
  color: text('color').notNull().default('#6366f1'),
  currentVersion: text('current_version'),
  status: text('status', { enum: ['active', 'beta', 'coming_soon', 'deprecated', 'archived'] }).notNull().default('active'),
  pricingJson: text('pricing_json').notNull().default('[]'),
  featuresJson: text('features_json').notNull().default('[]'),
  roadmapJson: text('roadmap_json').notNull().default('[]'),
  downloadUrl: text('download_url'),
  docsUrl: text('docs_url'),
  changelogUrl: text('changelog_url'),
  repoUrl: text('repo_url'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

export type Product = typeof products.$inferSelect

export const productReleases = pgTable('product_releases', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  type: text('type', { enum: ['major', 'minor', 'patch', 'hotfix', 'beta', 'rc'] }).notNull().default('minor'),
  titleEn: text('title_en'),
  changelogEn: text('changelog_en'),
  changelogFa: text('changelog_fa'),
  downloadUrl: text('download_url'),
  breakingChanges: boolean('breaking_changes').notNull().default(false),
  publishedAt: text('published_at').notNull().$defaultFn(tsNow),
  createdBy: text('created_by').references(() => users.id),
})

// ─── Phase 7: Documentation Platform ─────────────────────────────────────────

export const docCategories = pgTable('doc_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  icon: text('icon').notNull().default('📄'),
  color: text('color').notNull().default('#6366f1'),
  parentId: integer('parent_id'),
  type: text('type', { enum: ['docs', 'api', 'runbook', 'tutorial', 'guide', 'release'] }).notNull().default('docs'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

export const docs = pgTable('docs', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleFa: text('title_fa'),
  contentEn: text('content_en'),
  contentFa: text('content_fa'),
  excerptEn: text('excerpt_en'),
  categoryId: integer('category_id').references(() => docCategories.id),
  type: text('type', { enum: ['docs', 'api', 'runbook', 'tutorial', 'guide', 'release'] }).notNull().default('docs'),
  version: text('version').default('latest'),
  productId: integer('product_id').references(() => products.id),
  tagsJson: text('tags_json').notNull().default('[]'),
  codeExamplesJson: text('code_examples_json').notNull().default('[]'),
  relatedDocsJson: text('related_docs_json').notNull().default('[]'),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  readTimeMinutes: integer('read_time_minutes').default(5),
  views: integer('views').notNull().default(0),
  helpful: integer('helpful').notNull().default(0),
  notHelpful: integer('not_helpful').notNull().default(0),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

export type Doc = typeof docs.$inferSelect

// ─── Phase 7: Academy Platform ────────────────────────────────────────────────

export const courseCategories = pgTable('course_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  icon: text('icon').notNull().default('🎓'),
  color: text('color').notNull().default('#6366f1'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleFa: text('title_fa'),
  descriptionEn: text('description_en'),
  descriptionFa: text('description_fa'),
  categoryId: integer('category_id').references(() => courseCategories.id),
  level: text('level', { enum: ['beginner', 'intermediate', 'advanced', 'expert'] }).notNull().default('intermediate'),
  type: text('type', { enum: ['course', 'learning_path', 'bootcamp', 'certification'] }).notNull().default('course'),
  coverImage: text('cover_image'),
  durationHours: integer('duration_hours').default(0),
  lessonsCount: integer('lessons_count').notNull().default(0),
  labsCount: integer('labs_count').notNull().default(0),
  prerequisitesJson: text('prerequisites_json').notNull().default('[]'),
  outcomesJson: text('outcomes_json').notNull().default('[]'),
  instructorId: text('instructor_id').references(() => users.id),
  price: doublePrecision('price').notNull().default(0),
  isFree: boolean('is_free').notNull().default(true),
  certificateEnabled: boolean('certificate_enabled').notNull().default(false),
  enrollmentsCount: integer('enrollments_count').notNull().default(0),
  rating: doublePrecision('rating').notNull().default(0),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
})

export type Course = typeof courses.$inferSelect

export const courseLessons = pgTable('course_lessons', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  titleEn: text('title_en').notNull(),
  titleFa: text('title_fa'),
  contentEn: text('content_en'),
  type: text('type', { enum: ['video', 'text', 'lab', 'quiz', 'assignment'] }).notNull().default('text'),
  videoUrl: text('video_url'),
  durationMinutes: integer('duration_minutes').default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  isFree: boolean('is_free').notNull().default(false),
  active: boolean('active').notNull().default(true),
})

// ─── Phase 7: Events & Community ─────────────────────────────────────────────

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleFa: text('title_fa'),
  descriptionEn: text('description_en'),
  descriptionFa: text('description_fa'),
  type: text('type', { enum: ['webinar', 'conference', 'meetup', 'workshop', 'training', 'announcement'] }).notNull().default('webinar'),
  status: text('status', { enum: ['upcoming', 'live', 'completed', 'cancelled'] }).notNull().default('upcoming'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  timezone: text('timezone').notNull().default('Asia/Tehran'),
  format: text('format', { enum: ['online', 'in_person', 'hybrid'] }).notNull().default('online'),
  locationEn: text('location_en'),
  meetingUrl: text('meeting_url'),
  coverImage: text('cover_image'),
  speakersJson: text('speakers_json').notNull().default('[]'),
  agendaJson: text('agenda_json').notNull().default('[]'),
  tagsJson: text('tags_json').notNull().default('[]'),
  maxAttendees: integer('max_attendees'),
  registrationsCount: integer('registrations_count').notNull().default(0),
  registrationOpen: boolean('registration_open').notNull().default(true),
  isFree: boolean('is_free').notNull().default(true),
  featured: boolean('featured').notNull().default(false),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  createdBy: text('created_by').references(() => users.id),
})

export type Event = typeof events.$inferSelect

export const eventRegistrations = pgTable('event_registrations', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  company: text('company'),
  phone: text('phone'),
  status: text('status', { enum: ['pending', 'confirmed', 'attended', 'cancelled'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
})

// ─── Phase 7: Integrations ────────────────────────────────────────────────────

export const integrations = pgTable('integrations', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  category: text('category').notNull().default('productivity'),
  icon: text('icon').notNull().default('🔌'),
  color: text('color').notNull().default('#6366f1'),
  enabled: boolean('enabled').notNull().default(false),
  configJson: text('config_json').notNull().default('{}'),
  secretsJson: text('secrets_json').notNull().default('{}'),
  webhookUrl: text('webhook_url'),
  status: text('status', { enum: ['active', 'error', 'disabled', 'pending'] }).notNull().default('disabled'),
  lastSyncAt: text('last_sync_at'),
  errorMessage: text('error_message'),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

export type Integration = typeof integrations.$inferSelect

// ─── Phase 7: Partner & Customer Portals (Architecture) ───────────────────────

export const partners = pgTable('partners', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa'),
  type: text('type', { enum: ['technology', 'reseller', 'consultant', 'distributor', 'referral'] }).notNull().default('technology'),
  tier: text('tier', { enum: ['platinum', 'gold', 'silver', 'bronze'] }).notNull().default('silver'),
  logoUrl: text('logo_url'),
  website: text('website'),
  contactEmail: text('contact_email'),
  descriptionEn: text('description_en'),
  certificationsJson: text('certifications_json').notNull().default('[]'),
  regionsJson: text('regions_json').notNull().default('[]'),
  active: boolean('active').notNull().default(true),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
})

export type Partner = typeof partners.$inferSelect

// ─── Phase 7: RBAC Role Assignments ──────────────────────────────────────────

export const roleAssignments = pgTable('role_assignments', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  scope: text('scope', { enum: ['global', 'workspace', 'site', 'department'] }).notNull().default('global'),
  scopeId: text('scope_id'),
  grantedBy: text('granted_by').references(() => users.id),
  expiresAt: text('expires_at'),
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
})

// ─── Phase 7: Global Search Index ────────────────────────────────────────────

export const searchIndex = pgTable('search_index', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  entityId: text('entity_id').notNull(),
  titleEn: text('title_en').notNull(),
  titleFa: text('title_fa'),
  excerptEn: text('excerpt_en'),
  url: text('url').notNull(),
  icon: text('icon'),
  tags: text('tags'),
  workspaceId: text('workspace_id'),
  siteId: text('site_id'),
  locale: text('locale').default('both'),
  active: boolean('active').notNull().default(true),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
})

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 7.5 — ENTERPRISE ARCHITECTURE AUDIT: UNIFIED DOMAIN MODEL
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Unified: Organizations ────────────────────────────────────────────────────
// Consolidates: clients + partners
// type: client | employer | tech_partner | reseller | distributor | consultant
//       | vendor | referral | branch
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa'),
  type: text('type', {
    enum: ['client', 'employer', 'tech_partner', 'reseller', 'distributor',
           'consultant', 'vendor', 'referral', 'branch'],
  }).notNull().default('client'),
  tier: text('tier', { enum: ['platinum', 'gold', 'silver', 'bronze'] }),
  logoUrl: text('logo_url'),
  website: text('website'),
  contactEmail: text('contact_email'),
  phone: text('phone'),
  country: text('country'),
  descriptionEn: text('description_en'),
  descriptionFa: text('description_fa'),
  certificationsJson: text('certifications_json').notNull().default('[]'),
  regionsJson: text('regions_json').notNull().default('[]'),
  tagsJson: text('tags_json').notNull().default('[]'),
  active: boolean('active').notNull().default(true),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

export type Organization = typeof organizations.$inferSelect

// ─── Unified: Content Categories ──────────────────────────────────────────────
// Consolidates: blog_categories + doc_categories + course_categories
export const contentCategories = pgTable('content_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa').notNull(),
  icon: text('icon').notNull().default('📁'),
  color: text('color').notNull().default('#6366f1'),
  contentTypes: text('content_types').notNull().default('all'),
  parentId: integer('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

export type ContentCategory = typeof contentCategories.$inferSelect

// ─── Unified: Content ─────────────────────────────────────────────────────────
// Consolidates: blog_posts + docs
// type: blog | news | docs | api | tutorial | guide | runbook | release
//       | research | announcement
export const content = pgTable('content', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  type: text('type', {
    enum: ['blog', 'news', 'docs', 'api', 'tutorial', 'guide',
           'runbook', 'release', 'research', 'announcement'],
  }).notNull().default('blog'),
  titleEn: text('title_en').notNull(),
  titleFa: text('title_fa'),
  excerptEn: text('excerpt_en'),
  excerptFa: text('excerpt_fa'),
  contentEn: text('content_en'),
  contentFa: text('content_fa'),
  categoryId: integer('category_id').references(() => contentCategories.id),
  coverImage: text('cover_image'),
  version: text('version'),
  productId: integer('product_id').references(() => products.id),
  tagsJson: text('tags_json').notNull().default('[]'),
  readTimeMinutes: integer('read_time_minutes').default(5),
  views: integer('views').notNull().default(0),
  helpful: integer('helpful').notNull().default(0),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  featured: boolean('featured').notNull().default(false),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  seoKeywords: text('seo_keywords'),
  ogImage: text('og_image'),
  sortOrder: integer('sort_order').notNull().default(0),
  publishedAt: text('published_at'),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

export type Content = typeof content.$inferSelect

// ─── Unified: Credentials ─────────────────────────────────────────────────────
// Consolidates: certifications
// type: certification | award | membership | badge | license | recognition
export const credentials = pgTable('credentials', {
  id: serial('id').primaryKey(),
  type: text('type', {
    enum: ['certification', 'award', 'membership', 'badge', 'license', 'recognition'],
  }).notNull().default('certification'),
  nameEn: text('name_en').notNull(),
  nameFa: text('name_fa'),
  issuer: text('issuer'),
  issuerLogoUrl: text('issuer_logo_url'),
  issueDate: text('issue_date'),
  expiryDate: text('expiry_date'),
  credentialId: text('credential_id'),
  credentialUrl: text('credential_url'),
  badgeUrl: text('badge_url'),
  descriptionEn: text('description_en'),
  color: text('color').default('#6366f1'),
  icon: text('icon'),
  active: boolean('active').notNull().default(true),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: text('updated_at').notNull().$defaultFn(tsNow),
  updatedBy: text('updated_by').references(() => users.id),
})

export type Credential = typeof credentials.$inferSelect

// ─── Unified: Success Stories ─────────────────────────────────────────────────
// Extends testimonials with type + organization reference
export const successStories = pgTable('success_stories', {
  id: serial('id').primaryKey(),
  type: text('type', {
    enum: ['testimonial', 'recommendation', 'review', 'award'],
  }).notNull().default('testimonial'),
  personName: text('person_name').notNull(),
  personTitle: text('person_title'),
  personAvatar: text('person_avatar'),
  organizationId: integer('organization_id').references(() => organizations.id),
  organizationName: text('organization_name'),
  quoteEn: text('quote_en').notNull(),
  quoteFa: text('quote_fa'),
  rating: integer('rating').notNull().default(5),
  caseStudySlug: text('case_study_slug'),
  solutionSlug: text('solution_slug'),
  featured: boolean('featured').notNull().default(false),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(tsNow),
})

export type SuccessStory = typeof successStories.$inferSelect
