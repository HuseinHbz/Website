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

    -- CRM lead pipeline (Phase 15 foundation). Distinct from raw inbound
    -- contact_requests/consultation_requests — a lead carries pipeline stage,
    -- source, score and an owner.
    CREATE TABLE IF NOT EXISTS crm_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      source TEXT NOT NULL DEFAULT 'other' CHECK(source IN ('website','referral','consultation','contact_form','event','social','email','other')),
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','qualified','proposal','won','lost')),
      score INTEGER NOT NULL DEFAULT 0,
      value INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      owner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Feature Flag Center (Phase 18): global feature toggles with deterministic
    -- percentage rollout. Evaluated by lib/flags/evaluate.ts.
    CREATE TABLE IF NOT EXISTS feature_flags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 0,
      rollout_percent INTEGER NOT NULL DEFAULT 100 CHECK(rollout_percent BETWEEN 0 AND 100),
      owner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ERP asset register (Phase 16 foundation): IT asset lifecycle for HBZ
    -- Technology — servers, network gear, endpoints, licenses, cloud resources.
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other' CHECK(type IN ('server','network','firewall','switch','router','access_point','storage','vm','cloud','laptop','license','other')),
      serial TEXT,
      vendor TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','maintenance','retired','spare')),
      location TEXT,
      assigned_to TEXT,
      purchase_date TEXT,
      warranty_expiry TEXT,
      notes TEXT,
      owner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Real-time system log stream (application/API/db/backup/security events).
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      source TEXT,
      service TEXT,
      message TEXT NOT NULL,
      stacktrace TEXT,
      request_id TEXT,
      user_id TEXT,
      fingerprint TEXT,
      meta TEXT
    );

    -- Backup catalog written by the internal (cron-free) BackupEngine.
    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      env TEXT NOT NULL DEFAULT 'production',
      trigger TEXT NOT NULL,
      bucket TEXT,
      status TEXT NOT NULL DEFAULT 'started',
      size INTEGER NOT NULL DEFAULT 0,
      checksum TEXT,
      manifest TEXT,
      copies TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      verify_detail TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      section_type TEXT NOT NULL,
      variant TEXT NOT NULL DEFAULT 'default',
      title_en TEXT,
      title_fa TEXT,
      subtitle_en TEXT,
      subtitle_fa TEXT,
      content_en TEXT,
      content_fa TEXT,
      theme TEXT NOT NULL DEFAULT 'dark',
      bg_color TEXT,
      bg_image TEXT,
      bg_overlay REAL DEFAULT 0,
      media_url TEXT,
      media_alt TEXT,
      animation_in TEXT DEFAULT 'fade',
      visibility_rules TEXT,
      responsive_config TEXT,
      seo_title TEXT,
      seo_description TEXT,
      extra_data TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
      scheduled_at TEXT,
      archived_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES users(id),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS section_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title_en TEXT NOT NULL,
      title_fa TEXT NOT NULL,
      description_en TEXT,
      description_fa TEXT,
      seo_title TEXT,
      seo_description TEXT,
      og_image TEXT,
      layout TEXT NOT NULL DEFAULT 'default',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES users(id),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS page_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
  `)

  // ── Column additions for existing DBs ────────────────────────────────────
  const blogCatCols = sqlite.prepare(`PRAGMA table_info(blog_categories)`).all() as { name: string }[]
  if (!blogCatCols.find((c) => c.name === 'active')) {
    sqlite.exec(`ALTER TABLE blog_categories ADD COLUMN active INTEGER NOT NULL DEFAULT 1`)
  }

  const userCols = sqlite.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]
  if (!userCols.find((c) => c.name === 'totp_secret')) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT`)
  }
  if (!userCols.find((c) => c.name === 'totp_enabled')) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`)
  }

  // Phase 3: Case Study fields — ADD COLUMN is idempotent in SQLite via try/catch pattern
  const caseStudyCols = [
    "ALTER TABLE projects ADD COLUMN executive_summary_en TEXT",
    "ALTER TABLE projects ADD COLUMN executive_summary_fa TEXT",
    "ALTER TABLE projects ADD COLUMN existing_infra_en TEXT",
    "ALTER TABLE projects ADD COLUMN existing_infra_fa TEXT",
    "ALTER TABLE projects ADD COLUMN proposed_arch_en TEXT",
    "ALTER TABLE projects ADD COLUMN proposed_arch_fa TEXT",
    "ALTER TABLE projects ADD COLUMN tech_stack_json TEXT",
    "ALTER TABLE projects ADD COLUMN implementation_timeline_json TEXT",
    "ALTER TABLE projects ADD COLUMN lessons_learned_en TEXT",
    "ALTER TABLE projects ADD COLUMN lessons_learned_fa TEXT",
    "ALTER TABLE projects ADD COLUMN future_improvements_en TEXT",
    "ALTER TABLE projects ADD COLUMN future_improvements_fa TEXT",
    "ALTER TABLE projects ADD COLUMN business_scope_en TEXT",
    "ALTER TABLE projects ADD COLUMN business_scope_fa TEXT",
    "ALTER TABLE projects ADD COLUMN collaboration_type TEXT DEFAULT 'full'",
    "ALTER TABLE projects ADD COLUMN project_status TEXT DEFAULT 'completed'",
    "ALTER TABLE projects ADD COLUMN is_confidential INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE projects ADD COLUMN network_diagram_url TEXT",
    "ALTER TABLE projects ADD COLUMN infra_diagram_url TEXT",
    "ALTER TABLE projects ADD COLUMN download_pdf_url TEXT",
    "ALTER TABLE projects ADD COLUMN download_arch_url TEXT",
    "ALTER TABLE projects ADD COLUMN download_tech_summary_url TEXT",
    "ALTER TABLE projects ADD COLUMN client_logo_url TEXT",
    "ALTER TABLE projects ADD COLUMN technology_filters TEXT",
    "ALTER TABLE projects ADD COLUMN seo_title TEXT",
    "ALTER TABLE projects ADD COLUMN seo_description TEXT",
    "ALTER TABLE projects ADD COLUMN seo_keywords TEXT",
    "ALTER TABLE projects ADD COLUMN og_image TEXT",
    "ALTER TABLE projects ADD COLUMN ha_availability_en TEXT",
    "ALTER TABLE projects ADD COLUMN ha_availability_fa TEXT",
    "ALTER TABLE projects ADD COLUMN backup_strategy_en TEXT",
    "ALTER TABLE projects ADD COLUMN backup_strategy_fa TEXT",
    "ALTER TABLE projects ADD COLUMN disaster_recovery_en TEXT",
    "ALTER TABLE projects ADD COLUMN disaster_recovery_fa TEXT",
    "ALTER TABLE projects ADD COLUMN monitoring_strategy_en TEXT",
    "ALTER TABLE projects ADD COLUMN monitoring_strategy_fa TEXT",
    "ALTER TABLE projects ADD COLUMN security_considerations_en TEXT",
    "ALTER TABLE projects ADD COLUMN security_considerations_fa TEXT",
    "ALTER TABLE projects ADD COLUMN deployment_process_en TEXT",
    "ALTER TABLE projects ADD COLUMN deployment_process_fa TEXT",
    "ALTER TABLE projects ADD COLUMN before_after_json TEXT",
    "ALTER TABLE projects ADD COLUMN business_impact_json TEXT",
    "ALTER TABLE projects ADD COLUMN related_tags TEXT",
    "ALTER TABLE projects ADD COLUMN related_case_study_slugs TEXT",
  ]
  for (const col of caseStudyCols) {
    try { sqlite.exec(col) } catch { /* column already exists */ }
  }

  // Phase 4: Forms & Redirects tables
  const phase4Tables = [
    `CREATE TABLE IF NOT EXISTS forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'contact',
      fields_json TEXT NOT NULL DEFAULT '[]',
      settings_json TEXT NOT NULL DEFAULT '{}',
      email_to TEXT,
      email_subject TEXT,
      success_message_en TEXT,
      success_message_fa TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      submissions_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS redirects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_path TEXT NOT NULL UNIQUE,
      to_path TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 301,
      active INTEGER NOT NULL DEFAULT 1,
      hits INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ]
  for (const stmt of phase4Tables) {
    try { sqlite.exec(stmt) } catch { /* table already exists */ }
  }

  // Phase 5: AI Platform tables
  const phase5Tables = [
    `CREATE TABLE IF NOT EXISTS ai_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      description_en TEXT,
      description_fa TEXT,
      icon TEXT NOT NULL DEFAULT '🤖',
      category TEXT NOT NULL DEFAULT 'general',
      system_prompt TEXT,
      color TEXT NOT NULL DEFAULT 'indigo',
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      module_slug TEXT,
      title_en TEXT,
      locale TEXT NOT NULL DEFAULT 'en',
      messages_json TEXT NOT NULL DEFAULT '[]',
      sources_json TEXT NOT NULL DEFAULT '[]',
      bookmarked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ]
  for (const stmt of phase5Tables) {
    try { sqlite.exec(stmt) } catch { /* table already exists */ }
  }

  // Seed default AI modules if table is empty
  const moduleCount = (sqlite.prepare('SELECT COUNT(*) as c FROM ai_modules').get() as { c: number }).c
  if (moduleCount === 0) {
    const DEFAULT_MODULES = [
      { slug: 'infrastructure', nameEn: 'HBZ Infrastructure Advisor', nameFa: 'مشاور زیرساخت HBZ', descriptionEn: 'Data center, servers, storage, HA & DR design', descriptionFa: 'مرکز داده، سرور، ذخیره‌سازی، طراحی HA و DR', icon: '🏗', category: 'infrastructure', color: 'blue', sortOrder: 1, systemPrompt: 'You are HBZ Infrastructure Advisor, a senior enterprise infrastructure architect with 15+ years of experience in data center design, server architecture, SAN/NAS storage, high availability clustering, and disaster recovery planning. Provide structured, actionable recommendations with specific product names, configurations, and best practices. Format responses with clear sections, bullet points, and when relevant, configuration examples.' },
      { slug: 'network', nameEn: 'HBZ Network Advisor', nameFa: 'مشاور شبکه HBZ', descriptionEn: 'LAN/WAN, routing, switching, SD-WAN, network design', descriptionFa: 'LAN/WAN، مسیریابی، سوئیچینگ، SD-WAN', icon: '🌐', category: 'infrastructure', color: 'indigo', sortOrder: 2, systemPrompt: 'You are HBZ Network Advisor, an expert network engineer specializing in enterprise LAN/WAN design, Cisco, MikroTik, Juniper, BGP, OSPF, EIGRP, VLAN, VxLAN, SD-WAN, and network automation. Provide expert guidance with CLI examples, topology recommendations, and troubleshooting steps.' },
      { slug: 'cloud', nameEn: 'HBZ Cloud Advisor', nameFa: 'مشاور ابر HBZ', descriptionEn: 'Azure, AWS, GCP, hybrid cloud, migration strategy', descriptionFa: 'Azure، AWS، GCP، ابر ترکیبی، استراتژی مهاجرت', icon: '☁️', category: 'cloud', color: 'cyan', sortOrder: 3, systemPrompt: 'You are HBZ Cloud Advisor, a multi-cloud architect with expertise in Microsoft Azure, AWS, and GCP. Specializing in hybrid cloud design, cloud migration strategies, cost optimization, IaaS/PaaS/SaaS selection, and cloud governance. Provide detailed migration roadmaps, architecture diagrams in text format, and cost-benefit analyses.' },
      { slug: 'security', nameEn: 'HBZ Security Advisor', nameFa: 'مشاور امنیت HBZ', descriptionEn: 'Cybersecurity, firewalls, zero trust, compliance', descriptionFa: 'امنیت سایبری، فایروال، zero trust، انطباق', icon: '🔒', category: 'security', color: 'red', sortOrder: 4, systemPrompt: 'You are HBZ Security Advisor, a senior cybersecurity architect specializing in network security, firewall design (Cisco ASA/FTD, FortiGate, pfSense), Zero Trust architecture, IAM, SOC/SIEM, vulnerability management, and compliance (ISO 27001, NIST, PCI-DSS). Provide security assessments, hardening guides, and incident response frameworks.' },
      { slug: 'virtualization', nameEn: 'HBZ Virtualization Advisor', nameFa: 'مشاور مجازی‌سازی HBZ', descriptionEn: 'VMware, Hyper-V, Proxmox, container platforms', descriptionFa: 'VMware، Hyper-V، Proxmox، پلتفرم‌های کانتینر', icon: '🖥️', category: 'infrastructure', color: 'purple', sortOrder: 5, systemPrompt: 'You are HBZ Virtualization Advisor, an expert in enterprise virtualization platforms including VMware vSphere/vSAN, Microsoft Hyper-V, Proxmox, Nutanix, and container platforms (Docker, Kubernetes). Provide guidance on virt architecture, sizing, clustering, vMotion, and migration from physical to virtual.' },
      { slug: 'microsoft', nameEn: 'HBZ Microsoft Advisor', nameFa: 'مشاور مایکروسافت HBZ', descriptionEn: 'Active Directory, Exchange, SCCM, Intune, M365', descriptionFa: 'Active Directory، Exchange، SCCM، Intune، M365', icon: '🪟', category: 'infrastructure', color: 'blue', sortOrder: 6, systemPrompt: 'You are HBZ Microsoft Advisor, a Microsoft infrastructure specialist with expertise in Active Directory, DNS/DHCP, Exchange Server, SharePoint, SCCM/Intune, Microsoft 365, Azure AD, and Windows Server administration. Provide step-by-step configuration guides, PowerShell scripts, and best practice recommendations.' },
      { slug: 'linux', nameEn: 'HBZ Linux Advisor', nameFa: 'مشاور لینوکس HBZ', descriptionEn: 'Linux administration, scripting, hardening, containers', descriptionFa: 'مدیریت لینوکس، اسکریپت‌نویسی، سخت‌سازی', icon: '🐧', category: 'infrastructure', color: 'orange', sortOrder: 7, systemPrompt: 'You are HBZ Linux Advisor, a senior Linux engineer specializing in Red Hat/CentOS, Ubuntu/Debian, system administration, Bash/Python scripting, security hardening, performance tuning, and containerization (Docker, Podman, LXC). Provide commands, scripts, and configuration examples with explanations.' },
      { slug: 'monitoring', nameEn: 'HBZ Monitoring Advisor', nameFa: 'مشاور پایش HBZ', descriptionEn: 'Zabbix, Prometheus, Grafana, SNMP, observability', descriptionFa: 'Zabbix، Prometheus، Grafana، SNMP، observability', icon: '📊', category: 'operations', color: 'green', sortOrder: 8, systemPrompt: 'You are HBZ Monitoring Advisor, a specialist in enterprise monitoring and observability using Zabbix, Prometheus, Grafana, Nagios, PRTG, ELK Stack, and SNMP. Provide guidance on monitoring architecture, alert design, dashboard creation, and SLA management.' },
      { slug: 'career', nameEn: 'HBZ Career Advisor', nameFa: 'مشاور شغلی HBZ', descriptionEn: 'IT certifications, career paths, learning roadmaps', descriptionFa: 'گواهینامه‌های IT، مسیر شغلی، نقشه یادگیری', icon: '🎓', category: 'advisory', color: 'yellow', sortOrder: 9, systemPrompt: 'You are HBZ Career Advisor, an experienced IT career consultant who helps professionals navigate certifications (CCNA, CCNP, CCIE, MCSA, AWS, Azure, CompTIA), career transitions, skill development, and learning paths in networking, cloud, security, and infrastructure. Provide personalized roadmaps and study strategies.' },
      { slug: 'documentation', nameEn: 'HBZ Documentation Assistant', nameFa: 'دستیار مستندسازی HBZ', descriptionEn: 'Technical writing, runbooks, SOPs, architecture docs', descriptionFa: 'نوشتن فنی، runbook، SOP، مستندات معماری', icon: '📝', category: 'advisory', color: 'slate', sortOrder: 10, systemPrompt: 'You are HBZ Documentation Assistant, specializing in technical documentation, runbooks, standard operating procedures (SOPs), architecture documentation, and knowledge base articles for IT infrastructure. Help create professional, structured documentation with proper formatting, diagrams (described in text), and comprehensive coverage.' },
      { slug: 'architecture', nameEn: 'HBZ Architecture Reviewer', nameFa: 'بازبین معماری HBZ', descriptionEn: 'Architecture review, scalability, risk assessment', descriptionFa: 'بررسی معماری، مقیاس‌پذیری، ارزیابی ریسک', icon: '🏛️', category: 'advisory', color: 'indigo', sortOrder: 11, systemPrompt: 'You are HBZ Architecture Reviewer, a senior enterprise architect who evaluates IT architectures for scalability, security, availability, performance, and alignment with business objectives. Provide structured reviews covering: current state analysis, identified risks, improvement recommendations, and a scoring matrix across key dimensions.' },
      { slug: 'project', nameEn: 'HBZ Project Advisor', nameFa: 'مشاور پروژه HBZ', descriptionEn: 'IT project planning, timelines, resource estimation', descriptionFa: 'برنامه‌ریزی پروژه IT، زمان‌بندی، تخمین منابع', icon: '📋', category: 'advisory', color: 'teal', sortOrder: 12, systemPrompt: 'You are HBZ Project Advisor, an IT project management expert helping plan infrastructure projects, migrations, and technology implementations. Provide project charters, work breakdown structures, risk registers, resource estimates, and timeline recommendations following PMI/PRINCE2 methodologies adapted for IT infrastructure.' },
      { slug: 'solution', nameEn: 'HBZ Solution Designer', nameFa: 'طراح راهکار HBZ', descriptionEn: 'End-to-end solution design, BoM, technical proposals', descriptionFa: 'طراحی راهکار کامل، BoM، پیشنهادات فنی', icon: '💡', category: 'advisory', color: 'amber', sortOrder: 13, systemPrompt: 'You are HBZ Solution Designer, an expert at designing complete end-to-end IT solutions. You create comprehensive technical proposals including solution architecture, bill of materials (BoM), sizing calculations, vendor selection criteria, implementation phases, and ROI analysis for enterprise infrastructure projects.' },
      { slug: 'troubleshooting', nameEn: 'HBZ Troubleshooting Assistant', nameFa: 'دستیار عیب‌یابی HBZ', descriptionEn: 'Root cause analysis, systematic diagnostic approach', descriptionFa: 'تحلیل علت ریشه‌ای، رویکرد تشخیصی سیستماتیک', icon: '🔧', category: 'operations', color: 'rose', sortOrder: 14, systemPrompt: 'You are HBZ Troubleshooting Assistant, a systematic problem-solver for IT infrastructure issues. Use structured diagnostic methodologies (OSI model, divide and conquer, process of elimination) to guide troubleshooting of network, server, security, and application issues. Provide step-by-step diagnostic commands and root cause analysis frameworks.' },
    ]
    const insertModule = sqlite.prepare(`
      INSERT OR IGNORE INTO ai_modules (slug, name_en, name_fa, description_en, description_fa, icon, category, system_prompt, color, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const m of DEFAULT_MODULES) {
      insertModule.run(m.slug, m.nameEn, m.nameFa, m.descriptionEn, m.descriptionFa, m.icon, m.category, m.systemPrompt, m.color, m.sortOrder)
    }
  }

  // Phase 6: Solutions Platform tables
  const phase6Tables = [
    `CREATE TABLE IF NOT EXISTS solutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      tagline_en TEXT,
      tagline_fa TEXT,
      description_en TEXT,
      description_fa TEXT,
      icon TEXT NOT NULL DEFAULT '🔧',
      color TEXT NOT NULL DEFAULT '#6366f1',
      challenges_json TEXT NOT NULL DEFAULT '[]',
      approach_json TEXT NOT NULL DEFAULT '[]',
      benefits_json TEXT NOT NULL DEFAULT '[]',
      tech_stack_json TEXT NOT NULL DEFAULT '[]',
      roadmap_json TEXT NOT NULL DEFAULT '[]',
      faq_json TEXT NOT NULL DEFAULT '[]',
      metrics_json TEXT NOT NULL DEFAULT '[]',
      related_case_study_slugs TEXT,
      seo_title TEXT,
      seo_description TEXT,
      seo_keywords TEXT,
      og_image TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS industries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      tagline_en TEXT,
      tagline_fa TEXT,
      description_en TEXT,
      description_fa TEXT,
      icon TEXT NOT NULL DEFAULT '🏢',
      color TEXT NOT NULL DEFAULT '#6366f1',
      challenges_json TEXT NOT NULL DEFAULT '[]',
      solutions_json TEXT NOT NULL DEFAULT '[]',
      benefits_json TEXT NOT NULL DEFAULT '[]',
      related_solution_slugs TEXT,
      seo_title TEXT,
      seo_description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS technologies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      icon TEXT NOT NULL DEFAULT '⚙️',
      color TEXT NOT NULL DEFAULT '#6366f1',
      vendor TEXT,
      description_en TEXT,
      description_fa TEXT,
      logo_url TEXT,
      tier TEXT NOT NULL DEFAULT 'core' CHECK(tier IN ('core','advanced','specialized')),
      certifications TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      client_title TEXT,
      client_company TEXT,
      client_avatar TEXT,
      quote_en TEXT NOT NULL,
      quote_fa TEXT,
      rating INTEGER NOT NULL DEFAULT 5,
      project_slug TEXT,
      solution_slug TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS page_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      description_en TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      sections_json TEXT NOT NULL DEFAULT '[]',
      default_props_json TEXT NOT NULL DEFAULT '{}',
      preview_image TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ]
  for (const stmt of phase6Tables) {
    try { sqlite.exec(stmt) } catch { /* table already exists */ }
  }

  // Seed solutions
  const solutionCount = (sqlite.prepare('SELECT COUNT(*) as c FROM solutions').get() as { c: number }).c
  if (solutionCount === 0) {
    const DEFAULT_SOLUTIONS = [
      { slug: 'enterprise-networking', nameEn: 'Enterprise Networking', nameFa: 'شبکه سازمانی', taglineEn: 'High-performance, resilient network infrastructure for your business', taglineFa: 'زیرساخت شبکه با کارایی بالا برای کسب‌وکار شما', icon: '🌐', color: '#3b82f6', sortOrder: 1 },
      { slug: 'microsoft-infrastructure', nameEn: 'Microsoft Infrastructure', nameFa: 'زیرساخت مایکروسافت', taglineEn: 'Complete Microsoft ecosystem deployment and management', taglineFa: 'استقرار و مدیریت کامل اکوسیستم مایکروسافت', icon: '🪟', color: '#0ea5e9', sortOrder: 2 },
      { slug: 'linux-infrastructure', nameEn: 'Linux Infrastructure', nameFa: 'زیرساخت لینوکس', taglineEn: 'Enterprise-grade open-source infrastructure solutions', taglineFa: 'راهکارهای زیرساخت متن‌باز در سطح سازمانی', icon: '🐧', color: '#f97316', sortOrder: 3 },
      { slug: 'virtualization', nameEn: 'Virtualization Platform', nameFa: 'پلتفرم مجازی‌سازی', taglineEn: 'VMware, Hyper-V, Proxmox — optimize your compute resources', taglineFa: 'VMware، Hyper-V، Proxmox — بهینه‌سازی منابع محاسباتی', icon: '🖥️', color: '#8b5cf6', sortOrder: 4 },
      { slug: 'cloud-solutions', nameEn: 'Cloud Solutions', nameFa: 'راهکارهای ابری', taglineEn: 'Azure, AWS, GCP — multi-cloud strategy and migration', taglineFa: 'Azure، AWS، GCP — استراتژی چند ابری و مهاجرت', icon: '☁️', color: '#06b6d4', sortOrder: 5 },
      { slug: 'cybersecurity', nameEn: 'Cybersecurity', nameFa: 'امنیت سایبری', taglineEn: 'Zero trust architecture, threat detection and compliance', taglineFa: 'معماری zero trust، شناسایی تهدید و انطباق', icon: '🔒', color: '#ef4444', sortOrder: 6 },
      { slug: 'infrastructure-monitoring', nameEn: 'Infrastructure Monitoring', nameFa: 'پایش زیرساخت', taglineEn: 'Full-stack observability with Zabbix, Prometheus & Grafana', taglineFa: 'مشاهده‌پذیری کامل با Zabbix، Prometheus و Grafana', icon: '📊', color: '#22c55e', sortOrder: 7 },
      { slug: 'automation', nameEn: 'IT Automation', nameFa: 'اتوماسیون IT', taglineEn: 'Ansible, Terraform, CI/CD — eliminate manual operations', taglineFa: 'Ansible، Terraform، CI/CD — حذف عملیات دستی', icon: '⚙️', color: '#f59e0b', sortOrder: 8 },
      { slug: 'backup-disaster-recovery', nameEn: 'Backup & Disaster Recovery', nameFa: 'پشتیبان‌گیری و بازیابی از فاجعه', taglineEn: 'Protect your data with enterprise-grade backup and DR', taglineFa: 'محافظت از داده‌ها با پشتیبان‌گیری و DR سازمانی', icon: '💾', color: '#ec4899', sortOrder: 9 },
      { slug: 'business-continuity', nameEn: 'Business Continuity', nameFa: 'تداوم کسب‌وکار', taglineEn: 'Ensure 99.99% uptime with continuity planning', taglineFa: 'تضمین ۹۹.۹۹٪ آپتایم با برنامه‌ریزی تداوم', icon: '🔄', color: '#10b981', sortOrder: 10 },
      { slug: 'high-availability', nameEn: 'High Availability', nameFa: 'دسترس‌پذیری بالا', taglineEn: 'Eliminate single points of failure, achieve 5-nines uptime', taglineFa: 'حذف نقاط شکست تک، دستیابی به ۵ نه آپتایم', icon: '⚡', color: '#eab308', sortOrder: 11 },
      { slug: 'technical-consulting', nameEn: 'Technical Consulting', nameFa: 'مشاوره فنی', taglineEn: 'Expert architecture reviews, technology roadmaps, and advisory', taglineFa: 'بررسی معماری تخصصی، نقشه راه فناوری و مشاوره', icon: '🎯', color: '#6366f1', sortOrder: 12 },
      { slug: 'professional-services', nameEn: 'Professional Services', nameFa: 'خدمات حرفه‌ای', taglineEn: 'Deployment, migration, training, and knowledge transfer', taglineFa: 'استقرار، مهاجرت، آموزش و انتقال دانش', icon: '🤝', color: '#64748b', sortOrder: 13 },
      { slug: 'managed-services', nameEn: 'Managed Services', nameFa: 'خدمات مدیریت‌شده', taglineEn: '24/7 proactive monitoring, management and support', taglineFa: 'پایش فعال ۲۴/۷، مدیریت و پشتیبانی', icon: '🛡️', color: '#14b8a6', sortOrder: 14 },
    ]
    const insertSolution = sqlite.prepare(`INSERT OR IGNORE INTO solutions (slug, name_en, name_fa, tagline_en, tagline_fa, icon, color, sort_order) VALUES (?,?,?,?,?,?,?,?)`)
    for (const s of DEFAULT_SOLUTIONS) {
      insertSolution.run(s.slug, s.nameEn, s.nameFa, s.taglineEn, s.taglineFa, s.icon, s.color, s.sortOrder)
    }
  }

  // Seed industries
  const industryCount = (sqlite.prepare('SELECT COUNT(*) as c FROM industries').get() as { c: number }).c
  if (industryCount === 0) {
    const DEFAULT_INDUSTRIES = [
      { slug: 'finance-banking', nameEn: 'Finance & Banking', nameFa: 'مالی و بانکداری', icon: '🏦', color: '#22c55e', sortOrder: 1 },
      { slug: 'healthcare', nameEn: 'Healthcare', nameFa: 'بهداشت و درمان', icon: '🏥', color: '#ef4444', sortOrder: 2 },
      { slug: 'government', nameEn: 'Government & Public Sector', nameFa: 'دولت و بخش عمومی', icon: '🏛️', color: '#3b82f6', sortOrder: 3 },
      { slug: 'education', nameEn: 'Education', nameFa: 'آموزش', icon: '🎓', color: '#8b5cf6', sortOrder: 4 },
      { slug: 'retail-ecommerce', nameEn: 'Retail & E-Commerce', nameFa: 'خرده‌فروشی و تجارت الکترونیک', icon: '🛒', color: '#f97316', sortOrder: 5 },
      { slug: 'manufacturing', nameEn: 'Manufacturing', nameFa: 'تولید و صنعت', icon: '🏭', color: '#64748b', sortOrder: 6 },
      { slug: 'oil-gas-energy', nameEn: 'Oil, Gas & Energy', nameFa: 'نفت، گاز و انرژی', icon: '⚡', color: '#eab308', sortOrder: 7 },
      { slug: 'telecom', nameEn: 'Telecommunications', nameFa: 'مخابرات', icon: '📡', color: '#06b6d4', sortOrder: 8 },
      { slug: 'logistics', nameEn: 'Logistics & Supply Chain', nameFa: 'لجستیک و زنجیره تامین', icon: '🚛', color: '#10b981', sortOrder: 9 },
      { slug: 'real-estate', nameEn: 'Real Estate & Construction', nameFa: 'ساختمان و مستغلات', icon: '🏗️', color: '#ec4899', sortOrder: 10 },
    ]
    const insertIndustry = sqlite.prepare(`INSERT OR IGNORE INTO industries (slug, name_en, name_fa, icon, color, sort_order) VALUES (?,?,?,?,?,?)`)
    for (const i of DEFAULT_INDUSTRIES) {
      insertIndustry.run(i.slug, i.nameEn, i.nameFa, i.icon, i.color, i.sortOrder)
    }
  }

  // Seed technologies
  const techCount = (sqlite.prepare('SELECT COUNT(*) as c FROM technologies').get() as { c: number }).c
  if (techCount === 0) {
    const DEFAULT_TECHNOLOGIES = [
      { slug: 'cisco', nameEn: 'Cisco', nameFa: 'سیسکو', category: 'networking', icon: '🔵', color: '#1ba0d7', vendor: 'Cisco Systems', tier: 'core', sortOrder: 1 },
      { slug: 'mikrotik', nameEn: 'MikroTik', nameFa: 'میکروتیک', category: 'networking', icon: '🔴', color: '#d0002a', vendor: 'MikroTik', tier: 'core', sortOrder: 2 },
      { slug: 'vmware', nameEn: 'VMware vSphere', nameFa: 'VMware vSphere', category: 'virtualization', icon: '🟢', color: '#607078', vendor: 'Broadcom', tier: 'core', sortOrder: 3 },
      { slug: 'proxmox', nameEn: 'Proxmox VE', nameFa: 'Proxmox VE', category: 'virtualization', icon: '🟠', color: '#e57000', vendor: 'Proxmox', tier: 'core', sortOrder: 4 },
      { slug: 'microsoft-azure', nameEn: 'Microsoft Azure', nameFa: 'Microsoft Azure', category: 'cloud', icon: '☁️', color: '#0078d4', vendor: 'Microsoft', tier: 'core', sortOrder: 5 },
      { slug: 'aws', nameEn: 'Amazon AWS', nameFa: 'Amazon AWS', category: 'cloud', icon: '☁️', color: '#ff9900', vendor: 'Amazon', tier: 'core', sortOrder: 6 },
      { slug: 'windows-server', nameEn: 'Windows Server', nameFa: 'Windows Server', category: 'os', icon: '🪟', color: '#0078d4', vendor: 'Microsoft', tier: 'core', sortOrder: 7 },
      { slug: 'linux-rhel', nameEn: 'Red Hat / CentOS', nameFa: 'Red Hat / CentOS', category: 'os', icon: '🐧', color: '#ee0000', vendor: 'Red Hat', tier: 'core', sortOrder: 8 },
      { slug: 'zabbix', nameEn: 'Zabbix', nameFa: 'Zabbix', category: 'monitoring', icon: '📊', color: '#d40000', vendor: 'Zabbix', tier: 'core', sortOrder: 9 },
      { slug: 'prometheus', nameEn: 'Prometheus & Grafana', nameFa: 'Prometheus & Grafana', category: 'monitoring', icon: '📈', color: '#e6522c', vendor: 'CNCF', tier: 'advanced', sortOrder: 10 },
      { slug: 'fortigate', nameEn: 'FortiGate', nameFa: 'FortiGate', category: 'security', icon: '🔒', color: '#ee3124', vendor: 'Fortinet', tier: 'core', sortOrder: 11 },
      { slug: 'active-directory', nameEn: 'Active Directory', nameFa: 'Active Directory', category: 'identity', icon: '🏢', color: '#0078d4', vendor: 'Microsoft', tier: 'core', sortOrder: 12 },
      { slug: 'ansible', nameEn: 'Ansible', nameFa: 'Ansible', category: 'automation', icon: '⚙️', color: '#ee0000', vendor: 'Red Hat', tier: 'advanced', sortOrder: 13 },
      { slug: 'terraform', nameEn: 'Terraform', nameFa: 'Terraform', category: 'automation', icon: '🏗️', color: '#7b42bc', vendor: 'HashiCorp', tier: 'advanced', sortOrder: 14 },
      { slug: 'kubernetes', nameEn: 'Kubernetes', nameFa: 'Kubernetes', category: 'containers', icon: '🐋', color: '#326ce5', vendor: 'CNCF', tier: 'advanced', sortOrder: 15 },
      { slug: 'docker', nameEn: 'Docker', nameFa: 'Docker', category: 'containers', icon: '🐳', color: '#2496ed', vendor: 'Docker Inc', tier: 'core', sortOrder: 16 },
      { slug: 'palo-alto', nameEn: 'Palo Alto Networks', nameFa: 'Palo Alto Networks', category: 'security', icon: '🔐', color: '#fa582d', vendor: 'Palo Alto', tier: 'specialized', sortOrder: 17 },
      { slug: 'veeam', nameEn: 'Veeam Backup', nameFa: 'Veeam Backup', category: 'backup', icon: '💾', color: '#00b336', vendor: 'Veeam', tier: 'core', sortOrder: 18 },
      { slug: 'hyper-v', nameEn: 'Hyper-V', nameFa: 'Hyper-V', category: 'virtualization', icon: '🖥️', color: '#0078d4', vendor: 'Microsoft', tier: 'core', sortOrder: 19 },
      { slug: 'juniper', nameEn: 'Juniper Networks', nameFa: 'Juniper Networks', category: 'networking', icon: '🌿', color: '#84b135', vendor: 'Juniper', tier: 'advanced', sortOrder: 20 },
    ]
    const insertTech = sqlite.prepare(`INSERT OR IGNORE INTO technologies (slug, name_en, name_fa, category, icon, color, vendor, tier, sort_order) VALUES (?,?,?,?,?,?,?,?,?)`)
    for (const t of DEFAULT_TECHNOLOGIES) {
      insertTech.run(t.slug, t.nameEn, t.nameFa, t.category, t.icon, t.color, t.vendor, t.tier, t.sortOrder)
    }
  }

  // Phase 7: Enterprise Digital Ecosystem tables
  const phase7Tables = [
    `CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      domain TEXT,
      alt_domains TEXT,
      status TEXT NOT NULL DEFAULT 'staging' CHECK(status IN ('active','staging','archived','maintenance')),
      type TEXT NOT NULL DEFAULT 'corporate',
      theme_id TEXT,
      default_locale TEXT NOT NULL DEFAULT 'en',
      supported_locales TEXT NOT NULL DEFAULT 'en,fa',
      logo_url TEXT,
      favicon_url TEXT,
      home_page_slug TEXT,
      config_json TEXT NOT NULL DEFAULT '{}',
      seo_json TEXT NOT NULL DEFAULT '{}',
      share_media INTEGER NOT NULL DEFAULT 1,
      share_templates INTEGER NOT NULL DEFAULT 1,
      share_kb INTEGER NOT NULL DEFAULT 0,
      share_users INTEGER NOT NULL DEFAULT 0,
      workspace_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'corporate',
      icon TEXT NOT NULL DEFAULT '🏢',
      color TEXT NOT NULL DEFAULT '#6366f1',
      description_en TEXT,
      config_json TEXT NOT NULL DEFAULT '{}',
      isolation_level TEXT NOT NULL DEFAULT 'partial',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS organization (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legal_name_en TEXT NOT NULL DEFAULT 'HBZ Technology',
      legal_name_fa TEXT NOT NULL DEFAULT 'فناوری HBZ',
      brand_name_en TEXT NOT NULL DEFAULT 'HBZ Technology',
      brand_name_fa TEXT NOT NULL DEFAULT 'فناوری HBZ',
      tagline_en TEXT,
      tagline_fa TEXT,
      mission_en TEXT,
      mission_fa TEXT,
      logo_url TEXT,
      logo_mark_url TEXT,
      primary_color TEXT DEFAULT '#6366f1',
      secondary_color TEXT DEFAULT '#06b6d4',
      website TEXT,
      email TEXT,
      phone TEXT,
      address_json TEXT DEFAULT '{}',
      social_json TEXT DEFAULT '{}',
      legal_json TEXT DEFAULT '{}',
      business_units_json TEXT DEFAULT '[]',
      certifications_json TEXT DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🏢',
      head_user_id TEXT REFERENCES users(id),
      parent_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS office_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'branch',
      city TEXT,
      country TEXT,
      address_en TEXT,
      phone TEXT,
      email TEXT,
      lat REAL,
      lng REAL,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '📦',
      color TEXT NOT NULL DEFAULT '#6366f1',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      tagline_en TEXT,
      tagline_fa TEXT,
      description_en TEXT,
      description_fa TEXT,
      type TEXT NOT NULL DEFAULT 'service',
      category_id INTEGER REFERENCES product_categories(id),
      icon TEXT NOT NULL DEFAULT '📦',
      logo_url TEXT,
      color TEXT NOT NULL DEFAULT '#6366f1',
      current_version TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      pricing_json TEXT NOT NULL DEFAULT '[]',
      features_json TEXT NOT NULL DEFAULT '[]',
      roadmap_json TEXT NOT NULL DEFAULT '[]',
      download_url TEXT,
      docs_url TEXT,
      changelog_url TEXT,
      repo_url TEXT,
      seo_title TEXT,
      seo_description TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS product_releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      version TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'minor',
      title_en TEXT,
      changelog_en TEXT,
      changelog_fa TEXT,
      download_url TEXT,
      breaking_changes INTEGER NOT NULL DEFAULT 0,
      published_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS doc_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '📄',
      color TEXT NOT NULL DEFAULT '#6366f1',
      parent_id INTEGER,
      type TEXT NOT NULL DEFAULT 'docs',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title_en TEXT NOT NULL,
      title_fa TEXT,
      content_en TEXT,
      content_fa TEXT,
      excerpt_en TEXT,
      category_id INTEGER REFERENCES doc_categories(id),
      type TEXT NOT NULL DEFAULT 'docs',
      version TEXT DEFAULT 'latest',
      product_id INTEGER REFERENCES products(id),
      tags_json TEXT NOT NULL DEFAULT '[]',
      code_examples_json TEXT NOT NULL DEFAULT '[]',
      related_docs_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      read_time_minutes INTEGER DEFAULT 5,
      views INTEGER NOT NULL DEFAULT 0,
      helpful INTEGER NOT NULL DEFAULT 0,
      not_helpful INTEGER NOT NULL DEFAULT 0,
      seo_title TEXT,
      seo_description TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS course_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🎓',
      color TEXT NOT NULL DEFAULT '#6366f1',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title_en TEXT NOT NULL,
      title_fa TEXT,
      description_en TEXT,
      description_fa TEXT,
      category_id INTEGER REFERENCES course_categories(id),
      level TEXT NOT NULL DEFAULT 'intermediate',
      type TEXT NOT NULL DEFAULT 'course',
      cover_image TEXT,
      duration_hours INTEGER DEFAULT 0,
      lessons_count INTEGER NOT NULL DEFAULT 0,
      labs_count INTEGER NOT NULL DEFAULT 0,
      prerequisites_json TEXT NOT NULL DEFAULT '[]',
      outcomes_json TEXT NOT NULL DEFAULT '[]',
      instructor_id TEXT REFERENCES users(id),
      price REAL NOT NULL DEFAULT 0,
      is_free INTEGER NOT NULL DEFAULT 1,
      certificate_enabled INTEGER NOT NULL DEFAULT 0,
      enrollments_count INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS course_lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title_en TEXT NOT NULL,
      title_fa TEXT,
      content_en TEXT,
      type TEXT NOT NULL DEFAULT 'text',
      video_url TEXT,
      duration_minutes INTEGER DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_free INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title_en TEXT NOT NULL,
      title_fa TEXT,
      description_en TEXT,
      description_fa TEXT,
      type TEXT NOT NULL DEFAULT 'webinar',
      status TEXT NOT NULL DEFAULT 'upcoming',
      start_date TEXT NOT NULL,
      end_date TEXT,
      timezone TEXT NOT NULL DEFAULT 'Asia/Tehran',
      format TEXT NOT NULL DEFAULT 'online',
      location_en TEXT,
      meeting_url TEXT,
      cover_image TEXT,
      speakers_json TEXT NOT NULL DEFAULT '[]',
      agenda_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      max_attendees INTEGER,
      registrations_count INTEGER NOT NULL DEFAULT 0,
      registration_open INTEGER NOT NULL DEFAULT 1,
      is_free INTEGER NOT NULL DEFAULT 1,
      featured INTEGER NOT NULL DEFAULT 0,
      seo_title TEXT,
      seo_description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS event_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'productivity',
      icon TEXT NOT NULL DEFAULT '🔌',
      color TEXT NOT NULL DEFAULT '#6366f1',
      enabled INTEGER NOT NULL DEFAULT 0,
      config_json TEXT NOT NULL DEFAULT '{}',
      secrets_json TEXT NOT NULL DEFAULT '{}',
      webhook_url TEXT,
      status TEXT NOT NULL DEFAULT 'disabled',
      last_sync_at TEXT,
      error_message TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fa TEXT,
      type TEXT NOT NULL DEFAULT 'technology',
      tier TEXT NOT NULL DEFAULT 'silver',
      logo_url TEXT,
      website TEXT,
      contact_email TEXT,
      description_en TEXT,
      certifications_json TEXT NOT NULL DEFAULT '[]',
      regions_json TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS role_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'global',
      scope_id TEXT,
      granted_by TEXT REFERENCES users(id),
      expires_at TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS search_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_fa TEXT,
      excerpt_en TEXT,
      url TEXT NOT NULL,
      icon TEXT,
      tags TEXT,
      workspace_id TEXT,
      site_id TEXT,
      locale TEXT DEFAULT 'both',
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ]
  for (const stmt of phase7Tables) {
    try { sqlite.exec(stmt) } catch { /* table already exists */ }
  }

  // Seed Phase 7 defaults
  const orgCount = (sqlite.prepare('SELECT COUNT(*) as c FROM organization').get() as { c: number }).c
  if (orgCount === 0) {
    sqlite.exec(`INSERT INTO organization (legal_name_en, legal_name_fa, brand_name_en, brand_name_fa, tagline_en, tagline_fa, website, email, primary_color, secondary_color) VALUES ('HBZ Technology','فناوری HBZ','HBZ Technology','فناوری HBZ','Enterprise Technology Solutions','راهکارهای فناوری سازمانی','https://hbztechnology.com','info@hbztechnology.com','#6366f1','#06b6d4')`)
  }

  const workspaceCount = (sqlite.prepare('SELECT COUNT(*) as c FROM workspaces').get() as { c: number }).c
  if (workspaceCount === 0) {
    const DEFAULT_WORKSPACES = [
      { id: 'ws-personal', name: 'Personal Brand', slug: 'personal', type: 'personal', icon: '👤', color: '#6366f1', sortOrder: 1 },
      { id: 'ws-corporate', name: 'HBZ Technology', slug: 'corporate', type: 'corporate', icon: '🏢', color: '#3b82f6', sortOrder: 2 },
      { id: 'ws-academy', name: 'HBZ Academy', slug: 'academy', type: 'academy', icon: '🎓', color: '#8b5cf6', sortOrder: 3 },
      { id: 'ws-docs', name: 'Documentation', slug: 'docs', type: 'docs', icon: '📚', color: '#06b6d4', sortOrder: 4 },
      { id: 'ws-support', name: 'Support', slug: 'support', type: 'support', icon: '🛟', color: '#22c55e', sortOrder: 5 },
      { id: 'ws-partner', name: 'Partner Portal', slug: 'partner', type: 'partner', icon: '🤝', color: '#f59e0b', sortOrder: 6 },
      { id: 'ws-developer', name: 'Developer Portal', slug: 'developer', type: 'developer', icon: '⚡', color: '#ec4899', sortOrder: 7 },
    ]
    const insertWs = sqlite.prepare(`INSERT OR IGNORE INTO workspaces (id, name, slug, type, icon, color, sort_order) VALUES (?,?,?,?,?,?,?)`)
    for (const w of DEFAULT_WORKSPACES) { insertWs.run(w.id, w.name, w.slug, w.type, w.icon, w.color, w.sortOrder) }
  }

  const siteCount = (sqlite.prepare('SELECT COUNT(*) as c FROM sites').get() as { c: number }).c
  if (siteCount === 0) {
    const DEFAULT_SITES = [
      { id: 'site-main', name: 'HabiBazar.ir', slug: 'main', domain: 'habibazar.ir', type: 'personal', status: 'active', workspaceId: 'ws-personal', sortOrder: 1 },
      { id: 'site-corporate', name: 'HBZ Technology', slug: 'corporate', domain: 'hbztechnology.com', type: 'corporate', status: 'staging', workspaceId: 'ws-corporate', sortOrder: 2 },
      { id: 'site-academy', name: 'HBZ Academy', slug: 'academy', domain: 'academy.hbztechnology.com', type: 'academy', status: 'staging', workspaceId: 'ws-academy', sortOrder: 3 },
      { id: 'site-docs', name: 'HBZ Docs', slug: 'docs', domain: 'docs.hbztechnology.com', type: 'docs', status: 'staging', workspaceId: 'ws-docs', sortOrder: 4 },
      { id: 'site-support', name: 'HBZ Support', slug: 'support', domain: 'support.hbztechnology.com', type: 'support', status: 'staging', workspaceId: 'ws-support', sortOrder: 5 },
    ]
    const insertSite = sqlite.prepare(`INSERT OR IGNORE INTO sites (id, name, slug, domain, type, status, workspace_id) VALUES (?,?,?,?,?,?,?)`)
    for (const s of DEFAULT_SITES) { insertSite.run(s.id, s.name, s.slug, s.domain, s.type, s.status, s.workspaceId) }
  }

  const integrationCount = (sqlite.prepare('SELECT COUNT(*) as c FROM integrations').get() as { c: number }).c
  if (integrationCount === 0) {
    const DEFAULT_INTEGRATIONS = [
      { slug: 'microsoft-365', nameEn: 'Microsoft 365', category: 'productivity', icon: '🪟', color: '#0078d4', sortOrder: 1 },
      { slug: 'azure', nameEn: 'Microsoft Azure', category: 'cloud', icon: '☁️', color: '#0078d4', sortOrder: 2 },
      { slug: 'google-workspace', nameEn: 'Google Workspace', category: 'productivity', icon: '🔵', color: '#4285f4', sortOrder: 3 },
      { slug: 'slack', nameEn: 'Slack', category: 'communication', icon: '💬', color: '#4a154b', sortOrder: 4 },
      { slug: 'discord', nameEn: 'Discord', category: 'communication', icon: '🎮', color: '#5865f2', sortOrder: 5 },
      { slug: 'github', nameEn: 'GitHub', category: 'devops', icon: '🐙', color: '#333', sortOrder: 6 },
      { slug: 'gitlab', nameEn: 'GitLab', category: 'devops', icon: '🦊', color: '#fc6d26', sortOrder: 7 },
      { slug: 'jira', nameEn: 'Jira', category: 'project', icon: '📋', color: '#0052cc', sortOrder: 8 },
      { slug: 'cloudflare', nameEn: 'Cloudflare', category: 'infrastructure', icon: '🌐', color: '#f48120', sortOrder: 9 },
      { slug: 'vercel', nameEn: 'Vercel', category: 'infrastructure', icon: '▲', color: '#000', sortOrder: 10 },
      { slug: 'stripe', nameEn: 'Stripe', category: 'payments', icon: '💳', color: '#635bff', sortOrder: 11 },
      { slug: 'trello', nameEn: 'Trello', category: 'project', icon: '📌', color: '#0052cc', sortOrder: 12 },
    ]
    const insertInt = sqlite.prepare(`INSERT OR IGNORE INTO integrations (slug, name_en, category, icon, color, sort_order) VALUES (?,?,?,?,?,?)`)
    for (const i of DEFAULT_INTEGRATIONS) { insertInt.run(i.slug, i.nameEn, i.category, i.icon, i.color, i.sortOrder) }
  }

  const docCatCount = (sqlite.prepare('SELECT COUNT(*) as c FROM doc_categories').get() as { c: number }).c
  if (docCatCount === 0) {
    const DEFAULT_DOC_CATS = [
      { slug: 'getting-started', nameEn: 'Getting Started', nameFa: 'شروع سریع', icon: '🚀', color: '#22c55e', type: 'docs', sortOrder: 1 },
      { slug: 'api-reference', nameEn: 'API Reference', nameFa: 'مرجع API', icon: '⚡', color: '#3b82f6', type: 'api', sortOrder: 2 },
      { slug: 'architecture', nameEn: 'Architecture Guides', nameFa: 'راهنمای معماری', icon: '🏛️', color: '#8b5cf6', type: 'guide', sortOrder: 3 },
      { slug: 'runbooks', nameEn: 'Runbooks', nameFa: 'Runbook‌ها', icon: '📋', color: '#f59e0b', type: 'runbook', sortOrder: 4 },
      { slug: 'tutorials', nameEn: 'Tutorials', nameFa: 'آموزش‌ها', icon: '📖', color: '#ec4899', type: 'tutorial', sortOrder: 5 },
      { slug: 'release-notes', nameEn: 'Release Notes', nameFa: 'یادداشت‌های نسخه', icon: '📦', color: '#06b6d4', type: 'release', sortOrder: 6 },
    ]
    const insertDocCat = sqlite.prepare(`INSERT OR IGNORE INTO doc_categories (slug, name_en, name_fa, icon, color, type, sort_order) VALUES (?,?,?,?,?,?,?)`)
    for (const d of DEFAULT_DOC_CATS) { insertDocCat.run(d.slug, d.nameEn, d.nameFa, d.icon, d.color, d.type, d.sortOrder) }
  }

  const courseCatCount = (sqlite.prepare('SELECT COUNT(*) as c FROM course_categories').get() as { c: number }).c
  if (courseCatCount === 0) {
    const DEFAULT_COURSE_CATS = [
      { slug: 'networking', nameEn: 'Networking', nameFa: 'شبکه', icon: '🌐', color: '#3b82f6', sortOrder: 1 },
      { slug: 'security', nameEn: 'Cybersecurity', nameFa: 'امنیت سایبری', icon: '🔒', color: '#ef4444', sortOrder: 2 },
      { slug: 'cloud', nameEn: 'Cloud Computing', nameFa: 'رایانش ابری', icon: '☁️', color: '#06b6d4', sortOrder: 3 },
      { slug: 'linux', nameEn: 'Linux Administration', nameFa: 'مدیریت لینوکس', icon: '🐧', color: '#f97316', sortOrder: 4 },
      { slug: 'virtualization', nameEn: 'Virtualization', nameFa: 'مجازی‌سازی', icon: '🖥️', color: '#8b5cf6', sortOrder: 5 },
      { slug: 'devops', nameEn: 'DevOps & Automation', nameFa: 'DevOps و اتوماسیون', icon: '⚙️', color: '#22c55e', sortOrder: 6 },
    ]
    const insertCourseCat = sqlite.prepare(`INSERT OR IGNORE INTO course_categories (slug, name_en, name_fa, icon, color, sort_order) VALUES (?,?,?,?,?,?)`)
    for (const c of DEFAULT_COURSE_CATS) { insertCourseCat.run(c.slug, c.nameEn, c.nameFa, c.icon, c.color, c.sortOrder) }
  }

  // ─── Phase 7.5: Unified Domain Model Tables ──────────────────────────────────
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name_en TEXT NOT NULL,
        name_fa TEXT,
        type TEXT NOT NULL DEFAULT 'client'
          CHECK(type IN ('client','employer','tech_partner','reseller','distributor','consultant','vendor','referral','branch')),
        tier TEXT CHECK(tier IN ('platinum','gold','silver','bronze')),
        logo_url TEXT,
        website TEXT,
        contact_email TEXT,
        phone TEXT,
        country TEXT,
        description_en TEXT,
        description_fa TEXT,
        certifications_json TEXT NOT NULL DEFAULT '[]',
        regions_json TEXT NOT NULL DEFAULT '[]',
        tags_json TEXT NOT NULL DEFAULT '[]',
        active INTEGER NOT NULL DEFAULT 1,
        featured INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_by TEXT REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS content_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name_en TEXT NOT NULL,
        name_fa TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '📁',
        color TEXT NOT NULL DEFAULT '#6366f1',
        content_types TEXT NOT NULL DEFAULT 'all',
        parent_id INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'blog'
          CHECK(type IN ('blog','news','docs','api','tutorial','guide','runbook','release','research','announcement')),
        title_en TEXT NOT NULL,
        title_fa TEXT,
        excerpt_en TEXT,
        excerpt_fa TEXT,
        content_en TEXT,
        content_fa TEXT,
        category_id INTEGER REFERENCES content_categories(id),
        cover_image TEXT,
        version TEXT,
        product_id INTEGER REFERENCES products(id),
        tags_json TEXT NOT NULL DEFAULT '[]',
        read_time_minutes INTEGER DEFAULT 5,
        views INTEGER NOT NULL DEFAULT 0,
        helpful INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
        featured INTEGER NOT NULL DEFAULT 0,
        seo_title TEXT,
        seo_description TEXT,
        seo_keywords TEXT,
        og_image TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_by TEXT REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL DEFAULT 'certification'
          CHECK(type IN ('certification','award','membership','badge','license','recognition')),
        name_en TEXT NOT NULL,
        name_fa TEXT,
        issuer TEXT,
        issuer_logo_url TEXT,
        issue_date TEXT,
        expiry_date TEXT,
        credential_id TEXT,
        credential_url TEXT,
        badge_url TEXT,
        description_en TEXT,
        color TEXT DEFAULT '#6366f1',
        icon TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        featured INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_by TEXT REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS success_stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL DEFAULT 'testimonial'
          CHECK(type IN ('testimonial','recommendation','review','award')),
        person_name TEXT NOT NULL,
        person_title TEXT,
        person_avatar TEXT,
        organization_id INTEGER REFERENCES organizations(id),
        organization_name TEXT,
        quote_en TEXT NOT NULL,
        quote_fa TEXT,
        rating INTEGER NOT NULL DEFAULT 5,
        case_study_slug TEXT,
        solution_slug TEXT,
        featured INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
  } catch {}

  // Seed content_categories from existing blog_categories + doc_categories
  const contentCatCount = (sqlite.prepare('SELECT COUNT(*) as c FROM content_categories').get() as { c: number }).c
  if (contentCatCount === 0) {
    const DEFAULT_CONTENT_CATS = [
      { slug: 'technology', nameEn: 'Technology', nameFa: 'فناوری', icon: '⚙️', color: '#6366f1', contentTypes: 'blog,news,research' },
      { slug: 'networking', nameEn: 'Networking', nameFa: 'شبکه', icon: '🌐', color: '#3b82f6', contentTypes: 'blog,tutorial,docs' },
      { slug: 'cloud', nameEn: 'Cloud & Infrastructure', nameFa: 'ابر و زیرساخت', icon: '☁️', color: '#06b6d4', contentTypes: 'blog,tutorial,guide' },
      { slug: 'security', nameEn: 'Cybersecurity', nameFa: 'امنیت سایبری', icon: '🔒', color: '#ef4444', contentTypes: 'blog,guide,tutorial' },
      { slug: 'getting-started', nameEn: 'Getting Started', nameFa: 'شروع سریع', icon: '🚀', color: '#22c55e', contentTypes: 'docs,tutorial' },
      { slug: 'api-reference', nameEn: 'API Reference', nameFa: 'مرجع API', icon: '⚡', color: '#3b82f6', contentTypes: 'api,docs' },
      { slug: 'runbooks', nameEn: 'Runbooks', nameFa: 'Runbook‌ها', icon: '📋', color: '#f59e0b', contentTypes: 'runbook' },
      { slug: 'release-notes', nameEn: 'Release Notes', nameFa: 'یادداشت‌های نسخه', icon: '📦', color: '#06b6d4', contentTypes: 'release,announcement' },
    ]
    const insertCC = sqlite.prepare(`INSERT OR IGNORE INTO content_categories (slug, name_en, name_fa, icon, color, content_types) VALUES (?,?,?,?,?,?)`)
    for (const c of DEFAULT_CONTENT_CATS) { insertCC.run(c.slug, c.nameEn, c.nameFa, c.icon, c.color, c.contentTypes) }
  }

  const productCatCount = (sqlite.prepare('SELECT COUNT(*) as c FROM product_categories').get() as { c: number }).c
  if (productCatCount === 0) {
    const DEFAULT_PRODUCT_CATS = [
      { slug: 'infrastructure', nameEn: 'Infrastructure', nameFa: 'زیرساخت', icon: '🏗️', color: '#3b82f6', sortOrder: 1 },
      { slug: 'security', nameEn: 'Security', nameFa: 'امنیت', icon: '🔒', color: '#ef4444', sortOrder: 2 },
      { slug: 'monitoring', nameEn: 'Monitoring', nameFa: 'پایش', icon: '📊', color: '#22c55e', sortOrder: 3 },
      { slug: 'ai-tools', nameEn: 'AI Tools', nameFa: 'ابزارهای هوش مصنوعی', icon: '🤖', color: '#8b5cf6', sortOrder: 4 },
      { slug: 'services', nameEn: 'Professional Services', nameFa: 'خدمات حرفه‌ای', icon: '🤝', color: '#6366f1', sortOrder: 5 },
    ]
    const insertProdCat = sqlite.prepare(`INSERT OR IGNORE INTO product_categories (slug, name_en, name_fa, icon, color, sort_order) VALUES (?,?,?,?,?,?)`)
    for (const p of DEFAULT_PRODUCT_CATS) { insertProdCat.run(p.slug, p.nameEn, p.nameFa, p.icon, p.color, p.sortOrder) }
  }

  // ── Performance indexes (idempotent) ─────────────────────────────────────
  // Slugs/emails/tokens already have implicit indexes via UNIQUE. These cover
  // the hot filter/sort/foreign-key columns used by public pages and admin lists.
  const perfIndexes = [
    `CREATE INDEX IF NOT EXISTS idx_projects_active_sort ON projects(active, sort_order)`,
    `CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(featured)`,
    `CREATE INDEX IF NOT EXISTS idx_services_active_sort ON services(active, sort_order)`,
    `CREATE INDEX IF NOT EXISTS idx_solutions_active_sort ON solutions(active, sort_order)`,
    `CREATE INDEX IF NOT EXISTS idx_solutions_featured ON solutions(featured)`,
    `CREATE INDEX IF NOT EXISTS idx_industries_active_sort ON industries(active, sort_order)`,
    `CREATE INDEX IF NOT EXISTS idx_technologies_active_cat ON technologies(active, category)`,
    `CREATE INDEX IF NOT EXISTS idx_testimonials_active_featured ON testimonials(active, featured)`,
    `CREATE INDEX IF NOT EXISTS idx_timeline_active_sort ON timeline_items(active, sort_order)`,
    `CREATE INDEX IF NOT EXISTS idx_skills_active_sort ON skills(active, sort_order)`,
    `CREATE INDEX IF NOT EXISTS idx_certifications_active_sort ON certifications(active, sort_order)`,
    `CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(active)`,
    `CREATE INDEX IF NOT EXISTS idx_navigation_location ON navigation_items(location, active)`,
    `CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status)`,
    `CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sections_type_status ON sections(section_type, status)`,
    `CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status)`,
    `CREATE INDEX IF NOT EXISTS idx_page_sections_page ON page_sections(page_id)`,
    `CREATE INDEX IF NOT EXISTS idx_section_versions_section ON section_versions(section_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user ON admin_sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource)`,
    `CREATE INDEX IF NOT EXISTS idx_analytics_type_created ON analytics_events(type, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_syslogs_ts ON system_logs(ts)`,
    `CREATE INDEX IF NOT EXISTS idx_syslogs_level_ts ON system_logs(level, ts)`,
    `CREATE INDEX IF NOT EXISTS idx_syslogs_source ON system_logs(source)`,
    `CREATE INDEX IF NOT EXISTS idx_syslogs_fingerprint ON system_logs(fingerprint)`,
    `CREATE INDEX IF NOT EXISTS idx_backups_started ON backups(started_at)`,
    `CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status)`,
    `CREATE INDEX IF NOT EXISTS idx_assets_type_status ON assets(type, status)`,
    `CREATE INDEX IF NOT EXISTS idx_assets_warranty ON assets(warranty_expiry)`,
    `CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_requests(status)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_status ON consultation_requests(status)`,
    `CREATE INDEX IF NOT EXISTS idx_media_folder ON media_files(folder)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_kb_active ON ai_knowledge_base(active)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_conversations_module ON ai_conversations(module_slug)`,
  ]
  for (const stmt of perfIndexes) {
    try { sqlite.exec(stmt) } catch { /* table/column may not exist on older schemas */ }
  }

  sqlite.close()
}
