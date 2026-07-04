CREATE TABLE "about_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"headline" text,
	"subheadline" text,
	"bio" text,
	"photo_url" text,
	"resume_url" text,
	"years_exp" text,
	"projects_count" text,
	"endpoints_count" text,
	"deployments_count" text,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "admin_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"module_slug" text,
	"title_en" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"messages_json" text DEFAULT '[]' NOT NULL,
	"sources_json" text DEFAULT '[]' NOT NULL,
	"bookmarked" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_knowledge_base" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'document' NOT NULL,
	"content" text,
	"file_url" text,
	"source_url" text,
	"tags" text,
	"locale" text DEFAULT 'both',
	"active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "ai_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"description_en" text,
	"description_fa" text,
	"icon" text DEFAULT '🤖' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"system_prompt" text,
	"color" text DEFAULT 'indigo' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	CONSTRAINT "ai_modules_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"page" text,
	"referrer" text,
	"user_agent" text,
	"ip_address" text,
	"locale" text,
	"session_id" text,
	"metadata" text,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_email" text,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"old_value" text,
	"new_value" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"icon" text,
	"color" text DEFAULT '#6366f1',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "blog_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"title_fa" text NOT NULL,
	"excerpt_en" text,
	"excerpt_fa" text,
	"content_en" text,
	"content_fa" text,
	"category_id" integer,
	"cover_image" text,
	"read_time_en" text,
	"read_time_fa" text,
	"published_at_en" text,
	"published_at_fa" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"issuer" text,
	"issue_date" text,
	"expiry_date" text,
	"credential_id" text,
	"credential_url" text,
	"badge_url" text,
	"color" text DEFAULT '#6366f1',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"type_en" text,
	"type_fa" text,
	"logo_url" text,
	"website" text,
	"is_tech_partner" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "consultation_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company" text,
	"service_interest" text,
	"project_description" text,
	"budget" text,
	"timeline" text,
	"preferred_date" text,
	"preferred_time" text,
	"type" text DEFAULT 'full',
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text,
	"ip_address" text,
	"locale" text DEFAULT 'en',
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company" text,
	"subject" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"ip_address" text,
	"locale" text DEFAULT 'en',
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"type" text DEFAULT 'blog' NOT NULL,
	"title_en" text NOT NULL,
	"title_fa" text,
	"excerpt_en" text,
	"excerpt_fa" text,
	"content_en" text,
	"content_fa" text,
	"category_id" integer,
	"cover_image" text,
	"version" text,
	"product_id" integer,
	"tags_json" text DEFAULT '[]' NOT NULL,
	"read_time_minutes" integer DEFAULT 5,
	"views" integer DEFAULT 0 NOT NULL,
	"helpful" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text,
	"og_image" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published_at" text,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text,
	CONSTRAINT "content_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"icon" text DEFAULT '📁' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"content_types" text DEFAULT 'all' NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "content_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "course_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"icon" text DEFAULT '🎓' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "course_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "course_lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"title_en" text NOT NULL,
	"title_fa" text,
	"content_en" text,
	"type" text DEFAULT 'text' NOT NULL,
	"video_url" text,
	"duration_minutes" integer DEFAULT 0,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"title_fa" text,
	"description_en" text,
	"description_fa" text,
	"category_id" integer,
	"level" text DEFAULT 'intermediate' NOT NULL,
	"type" text DEFAULT 'course' NOT NULL,
	"cover_image" text,
	"duration_hours" integer DEFAULT 0,
	"lessons_count" integer DEFAULT 0 NOT NULL,
	"labs_count" integer DEFAULT 0 NOT NULL,
	"prerequisites_json" text DEFAULT '[]' NOT NULL,
	"outcomes_json" text DEFAULT '[]' NOT NULL,
	"instructor_id" text,
	"price" double precision DEFAULT 0 NOT NULL,
	"is_free" boolean DEFAULT true NOT NULL,
	"certificate_enabled" boolean DEFAULT false NOT NULL,
	"enrollments_count" integer DEFAULT 0 NOT NULL,
	"rating" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'certification' NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text,
	"issuer" text,
	"issuer_logo_url" text,
	"issue_date" text,
	"expiry_date" text,
	"credential_id" text,
	"credential_url" text,
	"badge_url" text,
	"description_en" text,
	"color" text DEFAULT '#6366f1',
	"icon" text,
	"active" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"icon" text DEFAULT '🏢' NOT NULL,
	"head_user_id" text,
	"parent_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "departments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "doc_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"icon" text DEFAULT '📄' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"parent_id" integer,
	"type" text DEFAULT 'docs' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "doc_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "docs" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"title_fa" text,
	"content_en" text,
	"content_fa" text,
	"excerpt_en" text,
	"category_id" integer,
	"type" text DEFAULT 'docs' NOT NULL,
	"version" text DEFAULT 'latest',
	"product_id" integer,
	"tags_json" text DEFAULT '[]' NOT NULL,
	"code_examples_json" text DEFAULT '[]' NOT NULL,
	"related_docs_json" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"read_time_minutes" integer DEFAULT 5,
	"views" integer DEFAULT 0 NOT NULL,
	"helpful" integer DEFAULT 0 NOT NULL,
	"not_helpful" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text,
	CONSTRAINT "docs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"phone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"title_fa" text,
	"description_en" text,
	"description_fa" text,
	"type" text DEFAULT 'webinar' NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"timezone" text DEFAULT 'Asia/Tehran' NOT NULL,
	"format" text DEFAULT 'online' NOT NULL,
	"location_en" text,
	"meeting_url" text,
	"cover_image" text,
	"speakers_json" text DEFAULT '[]' NOT NULL,
	"agenda_json" text DEFAULT '[]' NOT NULL,
	"tags_json" text DEFAULT '[]' NOT NULL,
	"max_attendees" integer,
	"registrations_count" integer DEFAULT 0 NOT NULL,
	"registration_open" boolean DEFAULT true NOT NULL,
	"is_free" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"created_by" text,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'contact' NOT NULL,
	"fields_json" text DEFAULT '[]' NOT NULL,
	"settings_json" text DEFAULT '{}' NOT NULL,
	"email_to" text,
	"email_subject" text,
	"success_message_en" text,
	"success_message_fa" text,
	"active" boolean DEFAULT true NOT NULL,
	"submissions_count" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"created_by" text,
	CONSTRAINT "forms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "hero_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"badge" text,
	"headline" text,
	"headline_highlight" text,
	"subheadline" text,
	"cta_primary" text,
	"cta_primary_href" text,
	"cta_secondary" text,
	"cta_secondary_href" text,
	"cta_tertiary" text,
	"cta_tertiary_href" text,
	"stat1_label" text,
	"stat1_value" text,
	"stat2_label" text,
	"stat2_value" text,
	"stat3_label" text,
	"stat3_value" text,
	"stat4_label" text,
	"stat4_value" text,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "industries" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"tagline_en" text,
	"tagline_fa" text,
	"description_en" text,
	"description_fa" text,
	"icon" text DEFAULT '🏢' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"challenges_json" text DEFAULT '[]' NOT NULL,
	"solutions_json" text DEFAULT '[]' NOT NULL,
	"benefits_json" text DEFAULT '[]' NOT NULL,
	"related_solution_slugs" text,
	"seo_title" text,
	"seo_description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	CONSTRAINT "industries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"category" text DEFAULT 'productivity' NOT NULL,
	"icon" text DEFAULT '🔌' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config_json" text DEFAULT '{}' NOT NULL,
	"secrets_json" text DEFAULT '{}' NOT NULL,
	"webhook_url" text,
	"status" text DEFAULT 'disabled' NOT NULL,
	"last_sync_at" text,
	"error_message" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text,
	CONSTRAINT "integrations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"url" text NOT NULL,
	"folder" text DEFAULT 'general',
	"alt" text,
	"caption" text,
	"uploaded_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"uploaded_by" text
);
--> statement-breakpoint
CREATE TABLE "navigation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"label_en" text NOT NULL,
	"label_fa" text NOT NULL,
	"href" text NOT NULL,
	"icon" text,
	"location" text DEFAULT 'header' NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "office_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"type" text DEFAULT 'branch' NOT NULL,
	"city" text,
	"country" text,
	"address_en" text,
	"phone" text,
	"email" text,
	"lat" double precision,
	"lng" double precision,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" serial PRIMARY KEY NOT NULL,
	"legal_name_en" text DEFAULT 'HBZ Technology' NOT NULL,
	"legal_name_fa" text DEFAULT 'فناوری HBZ' NOT NULL,
	"brand_name_en" text DEFAULT 'HBZ Technology' NOT NULL,
	"brand_name_fa" text DEFAULT 'فناوری HBZ' NOT NULL,
	"tagline_en" text,
	"tagline_fa" text,
	"mission_en" text,
	"mission_fa" text,
	"logo_url" text,
	"logo_mark_url" text,
	"primary_color" text DEFAULT '#6366f1',
	"secondary_color" text DEFAULT '#06b6d4',
	"website" text,
	"email" text,
	"phone" text,
	"address_json" text DEFAULT '{}',
	"social_json" text DEFAULT '{}',
	"legal_json" text DEFAULT '{}',
	"business_units_json" text DEFAULT '[]',
	"certifications_json" text DEFAULT '[]',
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text,
	"type" text DEFAULT 'client' NOT NULL,
	"tier" text,
	"logo_url" text,
	"website" text,
	"contact_email" text,
	"phone" text,
	"country" text,
	"description_en" text,
	"description_fa" text,
	"certifications_json" text DEFAULT '[]' NOT NULL,
	"regions_json" text DEFAULT '[]' NOT NULL,
	"tags_json" text DEFAULT '[]' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "page_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"section_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"description_en" text,
	"category" text DEFAULT 'general' NOT NULL,
	"sections_json" text DEFAULT '[]' NOT NULL,
	"default_props_json" text DEFAULT '{}' NOT NULL,
	"preview_image" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	CONSTRAINT "page_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"title_fa" text NOT NULL,
	"description_en" text,
	"description_fa" text,
	"seo_title" text,
	"seo_description" text,
	"og_image" text,
	"layout" text DEFAULT 'default' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" text,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text,
	"type" text DEFAULT 'technology' NOT NULL,
	"tier" text DEFAULT 'silver' NOT NULL,
	"logo_url" text,
	"website" text,
	"contact_email" text,
	"description_en" text,
	"certifications_json" text DEFAULT '[]' NOT NULL,
	"regions_json" text DEFAULT '[]' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	CONSTRAINT "partners_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"icon" text DEFAULT '📦' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "product_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"version" text NOT NULL,
	"type" text DEFAULT 'minor' NOT NULL,
	"title_en" text,
	"changelog_en" text,
	"changelog_fa" text,
	"download_url" text,
	"breaking_changes" boolean DEFAULT false NOT NULL,
	"published_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"tagline_en" text,
	"tagline_fa" text,
	"description_en" text,
	"description_fa" text,
	"type" text DEFAULT 'service' NOT NULL,
	"category_id" integer,
	"icon" text DEFAULT '📦' NOT NULL,
	"logo_url" text,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"current_version" text,
	"status" text DEFAULT 'active' NOT NULL,
	"pricing_json" text DEFAULT '[]' NOT NULL,
	"features_json" text DEFAULT '[]' NOT NULL,
	"roadmap_json" text DEFAULT '[]' NOT NULL,
	"download_url" text,
	"docs_url" text,
	"changelog_url" text,
	"repo_url" text,
	"seo_title" text,
	"seo_description" text,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"industry_en" text,
	"industry_fa" text,
	"client_en" text,
	"client_fa" text,
	"challenge_en" text,
	"challenge_fa" text,
	"solution_en" text,
	"solution_fa" text,
	"results_en" text,
	"results_fa" text,
	"tags_en" text,
	"tags_fa" text,
	"cover_image" text,
	"gallery" text,
	"color" text DEFAULT '#6366f1',
	"year" text,
	"duration" text,
	"executive_summary_en" text,
	"executive_summary_fa" text,
	"existing_infra_en" text,
	"existing_infra_fa" text,
	"proposed_arch_en" text,
	"proposed_arch_fa" text,
	"tech_stack_json" text,
	"implementation_timeline_json" text,
	"lessons_learned_en" text,
	"lessons_learned_fa" text,
	"future_improvements_en" text,
	"future_improvements_fa" text,
	"business_scope_en" text,
	"business_scope_fa" text,
	"collaboration_type" text,
	"project_status" text DEFAULT 'completed',
	"is_confidential" boolean DEFAULT false NOT NULL,
	"network_diagram_url" text,
	"infra_diagram_url" text,
	"download_pdf_url" text,
	"download_arch_url" text,
	"download_tech_summary_url" text,
	"client_logo_url" text,
	"technology_filters" text,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text,
	"og_image" text,
	"ha_availability_en" text,
	"ha_availability_fa" text,
	"backup_strategy_en" text,
	"backup_strategy_fa" text,
	"disaster_recovery_en" text,
	"disaster_recovery_fa" text,
	"monitoring_strategy_en" text,
	"monitoring_strategy_fa" text,
	"security_considerations_en" text,
	"security_considerations_fa" text,
	"deployment_process_en" text,
	"deployment_process_fa" text,
	"before_after_json" text,
	"business_impact_json" text,
	"related_tags" text,
	"related_case_study_slugs" text,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text NOT NULL,
	"status_code" integer DEFAULT 301 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	CONSTRAINT "redirects_from_path_unique" UNIQUE("from_path")
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"scope" text DEFAULT 'global' NOT NULL,
	"scope_id" text,
	"granted_by" text,
	"expires_at" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_index" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"entity_id" text NOT NULL,
	"title_en" text NOT NULL,
	"title_fa" text,
	"excerpt_en" text,
	"url" text NOT NULL,
	"icon" text,
	"tags" text,
	"workspace_id" text,
	"site_id" text,
	"locale" text DEFAULT 'both',
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"version" integer NOT NULL,
	"snapshot" text NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"section_type" text NOT NULL,
	"variant" text DEFAULT 'default' NOT NULL,
	"title_en" text,
	"title_fa" text,
	"subtitle_en" text,
	"subtitle_fa" text,
	"content_en" text,
	"content_fa" text,
	"theme" text DEFAULT 'dark' NOT NULL,
	"bg_color" text,
	"bg_image" text,
	"bg_overlay" double precision DEFAULT 0,
	"media_url" text,
	"media_alt" text,
	"animation_in" text DEFAULT 'fade',
	"visibility_rules" text,
	"responsive_config" text,
	"seo_title" text,
	"seo_description" text,
	"extra_data" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_at" text,
	"archived_at" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "seo_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_key" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"keywords" text,
	"og_title" text,
	"og_description" text,
	"og_image" text,
	"schema_markup" text,
	"canonical_url" text,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_en" text NOT NULL,
	"title_fa" text NOT NULL,
	"category_en" text NOT NULL,
	"category_fa" text NOT NULL,
	"short_desc_en" text,
	"short_desc_fa" text,
	"long_desc_en" text,
	"long_desc_fa" text,
	"features_en" text,
	"features_fa" text,
	"icon" text,
	"color" text DEFAULT '#6366f1',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"group" text DEFAULT 'general' NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text,
	CONSTRAINT "site_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"domain" text,
	"alt_domains" text,
	"status" text DEFAULT 'staging' NOT NULL,
	"type" text DEFAULT 'corporate' NOT NULL,
	"theme_id" text,
	"default_locale" text DEFAULT 'en' NOT NULL,
	"supported_locales" text DEFAULT 'en,fa' NOT NULL,
	"logo_url" text,
	"favicon_url" text,
	"home_page_slug" text,
	"config_json" text DEFAULT '{}' NOT NULL,
	"seo_json" text DEFAULT '{}' NOT NULL,
	"share_media" boolean DEFAULT true NOT NULL,
	"share_templates" boolean DEFAULT true NOT NULL,
	"share_kb" boolean DEFAULT false NOT NULL,
	"share_users" boolean DEFAULT false NOT NULL,
	"workspace_id" text,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"created_by" text,
	CONSTRAINT "sites_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"category_en" text NOT NULL,
	"category_fa" text NOT NULL,
	"level" integer DEFAULT 80 NOT NULL,
	"icon" text,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "solutions" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"tagline_en" text,
	"tagline_fa" text,
	"description_en" text,
	"description_fa" text,
	"icon" text DEFAULT '🔧' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"challenges_json" text DEFAULT '[]' NOT NULL,
	"approach_json" text DEFAULT '[]' NOT NULL,
	"benefits_json" text DEFAULT '[]' NOT NULL,
	"tech_stack_json" text DEFAULT '[]' NOT NULL,
	"roadmap_json" text DEFAULT '[]' NOT NULL,
	"faq_json" text DEFAULT '[]' NOT NULL,
	"metrics_json" text DEFAULT '[]' NOT NULL,
	"related_case_study_slugs" text,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text,
	"og_image" text,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text,
	CONSTRAINT "solutions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "success_stories" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'testimonial' NOT NULL,
	"person_name" text NOT NULL,
	"person_title" text,
	"person_avatar" text,
	"organization_id" integer,
	"organization_name" text,
	"quote_en" text NOT NULL,
	"quote_fa" text,
	"rating" integer DEFAULT 5 NOT NULL,
	"case_study_slug" text,
	"solution_slug" text,
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technologies" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fa" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"icon" text DEFAULT '⚙️' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"vendor" text,
	"description_en" text,
	"description_fa" text,
	"logo_url" text,
	"tier" text DEFAULT 'core' NOT NULL,
	"certifications" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "technologies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_name" text NOT NULL,
	"client_title" text,
	"client_company" text,
	"client_avatar" text,
	"quote_en" text NOT NULL,
	"quote_fa" text,
	"rating" integer DEFAULT 5 NOT NULL,
	"project_slug" text,
	"solution_slug" text,
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" text NOT NULL,
	"title_en" text NOT NULL,
	"title_fa" text NOT NULL,
	"company_en" text,
	"company_fa" text,
	"desc_en" text,
	"desc_fa" text,
	"color" text DEFAULT '#6366f1',
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"avatar" text,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"last_login" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" text DEFAULT 'corporate' NOT NULL,
	"icon" text DEFAULT '🏢' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"description_en" text,
	"config_json" text DEFAULT '{}' NOT NULL,
	"isolation_level" text DEFAULT 'partial' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) NOT NULL,
	"created_by" text,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "about_content" ADD CONSTRAINT "about_content_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_knowledge_base" ADD CONSTRAINT "ai_knowledge_base_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_blog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_category_id_content_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."content_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_category_id_course_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."course_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_user_id_users_id_fk" FOREIGN KEY ("head_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_category_id_doc_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."doc_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hero_content" ADD CONSTRAINT "hero_content_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_releases" ADD CONSTRAINT "product_releases_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_releases" ADD CONSTRAINT "product_releases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_versions" ADD CONSTRAINT "section_versions_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_versions" ADD CONSTRAINT "section_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_settings" ADD CONSTRAINT "seo_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solutions" ADD CONSTRAINT "solutions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "success_stories" ADD CONSTRAINT "success_stories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_items" ADD CONSTRAINT "timeline_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;