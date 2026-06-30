import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'habibazar.db')

export function runMigrations() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const sqlite = new Database(DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('super_admin','administrator','editor')),
      active INTEGER NOT NULL DEFAULT 1,
      avatar TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip_address TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      "group" TEXT NOT NULL DEFAULT 'general',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS seo_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_key TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'en',
      meta_title TEXT,
      meta_description TEXT,
      keywords TEXT,
      og_title TEXT,
      og_description TEXT,
      og_image TEXT,
      schema_markup TEXT,
      canonical_url TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id),
      UNIQUE(page_key, locale)
    );

    CREATE TABLE IF NOT EXISTS hero_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      locale TEXT NOT NULL DEFAULT 'en' UNIQUE,
      badge TEXT,
      headline TEXT,
      headline_highlight TEXT,
      subheadline TEXT,
      cta_primary TEXT,
      cta_primary_href TEXT,
      cta_secondary TEXT,
      cta_secondary_href TEXT,
      cta_tertiary TEXT,
      cta_tertiary_href TEXT,
      stat1_label TEXT,
      stat1_value TEXT,
      stat2_label TEXT,
      stat2_value TEXT,
      stat3_label TEXT,
      stat3_value TEXT,
      stat4_label TEXT,
      stat4_value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS about_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      locale TEXT NOT NULL DEFAULT 'en' UNIQUE,
      headline TEXT,
      subheadline TEXT,
      bio TEXT,
      photo_url TEXT,
      resume_url TEXT,
      years_exp TEXT,
      projects_count TEXT,
      endpoints_count TEXT,
      deployments_count TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS timeline_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_fa TEXT NOT NULL,
      company_en TEXT,
      company_fa TEXT,
      desc_en TEXT,
      desc_fa TEXT,
      color TEXT DEFAULT '#6366f1',
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      category_en TEXT NOT NULL,
      category_fa TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 80,
      icon TEXT,
      color TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS certifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      issuer TEXT,
      issue_date TEXT,
      expiry_date TEXT,
      credential_id TEXT,
      credential_url TEXT,
      badge_url TEXT,
      color TEXT DEFAULT '#6366f1',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title_en TEXT NOT NULL,
      title_fa TEXT NOT NULL,
      category_en TEXT NOT NULL,
      category_fa TEXT NOT NULL,
      short_desc_en TEXT,
      short_desc_fa TEXT,
      long_desc_en TEXT,
      long_desc_fa TEXT,
      features_en TEXT,
      features_fa TEXT,
      icon TEXT,
      color TEXT DEFAULT '#6366f1',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      industry_en TEXT,
      industry_fa TEXT,
      client_en TEXT,
      client_fa TEXT,
      challenge_en TEXT,
      challenge_fa TEXT,
      solution_en TEXT,
      solution_fa TEXT,
      results_en TEXT,
      results_fa TEXT,
      tags_en TEXT,
      tags_fa TEXT,
      cover_image TEXT,
      gallery TEXT,
      color TEXT DEFAULT '#6366f1',
      year TEXT,
      duration TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      type_en TEXT,
      type_fa TEXT,
      logo_url TEXT,
      website TEXT,
      is_tech_partner INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS blog_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      icon TEXT,
      color TEXT DEFAULT '#6366f1',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title_en TEXT NOT NULL,
      title_fa TEXT NOT NULL,
      excerpt_en TEXT,
      excerpt_fa TEXT,
      content_en TEXT,
      content_fa TEXT,
      category_id INTEGER REFERENCES blog_categories(id),
      cover_image TEXT,
      read_time_en TEXT,
      read_time_fa TEXT,
      published_at_en TEXT,
      published_at_fa TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
      featured INTEGER NOT NULL DEFAULT 0,
      views INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS navigation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label_en TEXT NOT NULL,
      label_fa TEXT NOT NULL,
      href TEXT NOT NULL,
      icon TEXT,
      location TEXT NOT NULL DEFAULT 'header' CHECK(location IN ('header','footer')),
      parent_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS media_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      url TEXT NOT NULL,
      folder TEXT DEFAULT 'general',
      alt TEXT,
      caption TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      uploaded_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ai_knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'document' CHECK(type IN ('document','faq','snippet','url')),
      content TEXT,
      file_url TEXT,
      source_url TEXT,
      tags TEXT,
      locale TEXT DEFAULT 'both',
      active INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS contact_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      company TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','read','replied','archived')),
      ip_address TEXT,
      locale TEXT DEFAULT 'en',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS consultation_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      company TEXT,
      service_interest TEXT,
      project_description TEXT,
      budget TEXT,
      timeline TEXT,
      preferred_date TEXT,
      preferred_time TEXT,
      type TEXT DEFAULT 'full' CHECK(type IN ('intro','full','technical')),
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','scheduled','completed','cancelled')),
      notes TEXT,
      ip_address TEXT,
      locale TEXT DEFAULT 'en',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      page TEXT,
      referrer TEXT,
      user_agent TEXT,
      ip_address TEXT,
      locale TEXT,
      session_id TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id),
      user_email TEXT,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // ── Column additions for existing DBs ────────────────────────────────────
  const cols = sqlite.prepare(`PRAGMA table_info(blog_categories)`).all() as { name: string }[]
  if (!cols.find((c) => c.name === 'active')) {
    sqlite.exec(`ALTER TABLE blog_categories ADD COLUMN active INTEGER NOT NULL DEFAULT 1`)
  }

  sqlite.close()
}
