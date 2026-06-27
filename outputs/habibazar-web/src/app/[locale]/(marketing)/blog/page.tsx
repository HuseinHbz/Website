import { SITE } from '@/lib/site'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const isRTL = locale === 'fa'
  return {
    title: isRTL
      ? 'وبلاگ فنی — زیرساخت، امنیت و شبکه | HBZ'
      : 'Technical Blog — Infrastructure, Security & Networking | HBZ',
    description: isRTL
      ? 'مقالات تخصصی درباره میکروتیک، سیسکو، لینوکس، VMware، Proxmox، امنیت شبکه، پایش، خودکارسازی توسط حسین حبیب‌آذر.'
      : 'Expert articles on MikroTik, Cisco, Linux, VMware, Proxmox, network security, monitoring, automation, and DevOps by Husein Habibazar.',
    openGraph: {
      url: `${SITE.url}/${locale}/blog`,
    },
  }
}

interface Props {
  params: Promise<{ locale: string }>
}

const BLOG_CATEGORIES_EN = [
  { name: 'MikroTik', icon: '🌐', count: 8, color: '#c03030' },
  { name: 'Cisco', icon: '🔷', count: 6, color: '#1ba0d7' },
  { name: 'Linux', icon: '🐧', count: 12, color: '#f59e0b' },
  { name: 'Windows Server', icon: '🪟', count: 5, color: '#00adef' },
  { name: 'VMware', icon: '☁️', count: 7, color: '#60b6e0' },
  { name: 'Proxmox', icon: '🖥️', count: 4, color: '#e57000' },
  { name: 'Security', icon: '🛡️', count: 9, color: '#ef4444' },
  { name: 'Monitoring', icon: '📊', count: 6, color: '#f59e0b' },
  { name: 'Automation', icon: '⚙️', count: 5, color: '#06b6d4' },
  { name: 'DevOps', icon: '🚀', count: 4, color: '#818cf8' },
]

const BLOG_CATEGORIES_FA = [
  { name: 'میکروتیک', icon: '🌐', count: 8, color: '#c03030' },
  { name: 'سیسکو', icon: '🔷', count: 6, color: '#1ba0d7' },
  { name: 'لینوکس', icon: '🐧', count: 12, color: '#f59e0b' },
  { name: 'ویندوز سرور', icon: '🪟', count: 5, color: '#00adef' },
  { name: 'VMware', icon: '☁️', count: 7, color: '#60b6e0' },
  { name: 'Proxmox', icon: '🖥️', count: 4, color: '#e57000' },
  { name: 'امنیت', icon: '🛡️', count: 9, color: '#ef4444' },
  { name: 'پایش', icon: '📊', count: 6, color: '#f59e0b' },
  { name: 'خودکارسازی', icon: '⚙️', count: 5, color: '#06b6d4' },
  { name: 'دواپس', icon: '🚀', count: 4, color: '#818cf8' },
]

const FEATURED_POSTS_EN = [
  { title: 'Building a Multi-Site MikroTik Network with OSPF', category: 'MikroTik', date: 'Jan 2025', readTime: '12 min read', excerpt: 'A complete guide to designing and deploying multi-site OSPF routing with MikroTik RouterOS for enterprise branch offices.', color: '#c03030' },
  { title: 'Zero-Trust Network Architecture with Fortigate', category: 'Security', date: 'Feb 2025', readTime: '15 min read', excerpt: 'Implementing a zero-trust security model using Fortigate NGFW, SSL inspection, and micro-segmentation for enterprise environments.', color: '#ef4444' },
  { title: 'Proxmox VE Cluster Setup for Production Workloads', category: 'Proxmox', date: 'Mar 2025', readTime: '18 min read', excerpt: 'Step-by-step guide to building a 3-node Proxmox cluster with Ceph storage, HA failover, and live migration for production VMs.', color: '#e57000' },
  { title: 'Zabbix 7.0 Advanced Monitoring: Custom Dashboards', category: 'Monitoring', date: 'Apr 2025', readTime: '10 min read', excerpt: 'Creating enterprise-grade Zabbix dashboards with custom metrics, triggers, and Grafana integration for infrastructure visibility.', color: '#f59e0b' },
  { title: 'Ansible for Network Automation: MikroTik & Cisco', category: 'Automation', date: 'May 2025', readTime: '14 min read', excerpt: 'Automating network device configuration with Ansible: real playbooks for MikroTik RouterOS and Cisco IOS environments.', color: '#06b6d4' },
  { title: 'Linux Server Hardening: Production Security Checklist', category: 'Linux', date: 'Jun 2025', readTime: '16 min read', excerpt: 'Comprehensive security hardening checklist for Linux production servers: SSH, firewall, audit, SELinux, and automated compliance.', color: '#f59e0b' },
]

const FEATURED_POSTS_FA = [
  { title: 'ساخت شبکه چند سایته MikroTik با OSPF', category: 'میکروتیک', date: 'دی ۱۴۰۳', readTime: '۱۲ دقیقه مطالعه', excerpt: 'راهنمای کامل طراحی و استقرار مسیریابی OSPF چند سایته با MikroTik RouterOS برای دفاتر شعبه سازمانی.', color: '#c03030' },
  { title: 'معماری شبکه Zero-Trust با Fortigate', category: 'امنیت', date: 'بهمن ۱۴۰۳', readTime: '۱۵ دقیقه مطالعه', excerpt: 'پیاده‌سازی مدل امنیتی Zero-Trust با استفاده از Fortigate NGFW، بازرسی SSL و میکرو-تقسیم‌بندی برای محیط‌های سازمانی.', color: '#ef4444' },
  { title: 'راه‌اندازی کلاستر Proxmox VE برای بارکارهای تولیدی', category: 'Proxmox', date: 'اسفند ۱۴۰۳', readTime: '۱۸ دقیقه مطالعه', excerpt: 'راهنمای گام به گام ساخت کلاستر ۳ نودی Proxmox با ذخیره‌سازی Ceph، Failover HA و Live Migration برای VM‌های تولیدی.', color: '#e57000' },
  { title: 'پایش پیشرفته Zabbix 7.0: داشبوردهای اختصاصی', category: 'پایش', date: 'فروردین ۱۴۰۴', readTime: '۱۰ دقیقه مطالعه', excerpt: 'ساخت داشبوردهای سطح سازمانی در Zabbix با متریک‌های اختصاصی، ترایگرها و یکپارچه‌سازی Grafana برای دید زیرساختی.', color: '#f59e0b' },
  { title: 'Ansible برای خودکارسازی شبکه: MikroTik و Cisco', category: 'خودکارسازی', date: 'اردیبهشت ۱۴۰۴', readTime: '۱۴ دقیقه مطالعه', excerpt: 'خودکارسازی پیکربندی تجهیزات شبکه با Ansible: Playbook‌های واقعی برای MikroTik RouterOS و Cisco IOS.', color: '#06b6d4' },
  { title: 'سخت‌سازی سرور لینوکس: چک‌لیست امنیتی تولیدی', category: 'لینوکس', date: 'خرداد ۱۴۰۴', readTime: '۱۶ دقیقه مطالعه', excerpt: 'چک‌لیست جامع سخت‌سازی امنیتی سرورهای لینوکس تولیدی: SSH، فایروال، Audit، SELinux و انطباق خودکار.', color: '#f59e0b' },
]

export default async function BlogPage({ params }: Props) {
  const { locale } = await params
  const isRTL = locale === 'fa'

  const BLOG_CATEGORIES = isRTL ? BLOG_CATEGORIES_FA : BLOG_CATEGORIES_EN
  const FEATURED_POSTS = isRTL ? FEATURED_POSTS_FA : FEATURED_POSTS_EN

  return (
    <div className="pt-16" dir={isRTL ? 'rtl' : 'ltr'}>
      <section className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

        <div className="container-site relative z-10">
          {/* Header */}
          <div className="text-center mb-16">
            <p className="section-label mb-3">
              {isRTL ? 'وبلاگ فنی' : 'Technical Blog'}
            </p>
            <h1 className="section-title mb-4">
              {isRTL ? 'مرکز دانش ' : 'Infrastructure '}
              <span className="gradient-text">
                {isRTL ? 'زیرساخت' : 'Knowledge Hub'}
              </span>
            </h1>
            <p className="section-subtitle max-w-2xl mx-auto">
              {isRTL
                ? 'مقالات فنی عمیق درباره شبکه سازمانی، امنیت، مجازی‌سازی، پایش و خودکارسازی — نوشته‌شده از تجربه واقعی.'
                : 'Deep-dive technical articles on enterprise networking, security, virtualization, monitoring, and automation — written from real-world experience.'}
            </p>
          </div>

          {/* Category grid */}
          <div className="mb-16">
            <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-6">
              {isRTL ? 'مرور بر اساس دسته‌بندی' : 'Browse by Category'}
            </h2>
            <div className="flex flex-wrap gap-3">
              {BLOG_CATEGORIES.map((cat) => (
                <div
                  key={cat.name}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer hover:scale-105 transition-transform"
                  style={{ background: `${cat.color}15`, border: `1px solid ${cat.color}30` }}
                >
                  <span>{cat.icon}</span>
                  <span className="text-sm font-medium" style={{ color: cat.color }}>{cat.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${cat.color}20`, color: cat.color }}>
                    {cat.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Featured posts */}
          <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-6">
            {isRTL ? 'آخرین مقالات' : 'Latest Articles'}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURED_POSTS.map((post, i) => (
              <article key={i} className="service-card group cursor-pointer">
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                  style={{ background: `linear-gradient(90deg, ${post.color}, transparent)` }}
                />
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: `${post.color}15`, color: post.color }}
                  >
                    {post.category}
                  </span>
                  <span className="text-xs text-text-muted">{post.readTime}</span>
                </div>
                <h3 className="text-base font-bold text-text-primary mb-3 group-hover:text-accent transition-colors leading-snug">
                  {post.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-4 line-clamp-3">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <span className="text-xs text-text-muted">{post.date}</span>
                  <span className="text-xs text-accent font-medium group-hover:text-accent-hover transition-colors">
                    {isRTL ? 'خواندن مقاله ←' : 'Read Article →'}
                  </span>
                </div>
              </article>
            ))}
          </div>

          {/* Coming soon */}
          <div className="mt-16 text-center p-8 glass-card rounded-2xl">
            <div className="text-3xl mb-3">📝</div>
            <h3 className="text-lg font-bold text-text-primary mb-2">
              {isRTL ? 'وبلاگ کامل به زودی' : 'Full Blog Coming Soon'}
            </h3>
            <p className="text-text-secondary text-sm max-w-md mx-auto">
              {isRTL
                ? 'پلتفرم کامل وبلاگ با جستجو، فیلترینگ، هایلایت کد و فید RSS در حال توسعه است.'
                : 'The complete blog platform with search, filtering, syntax highlighting, and RSS feed is currently in development.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
