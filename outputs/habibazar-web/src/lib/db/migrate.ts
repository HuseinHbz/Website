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

  sqlite.close()
}
