import { SITE } from '@/lib/site'
import type { Metadata } from 'next'
import { getPublicBlogPosts, getPublicBlogCategories } from '@/lib/publicData'

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

const FALLBACK_CATEGORIES_EN = [
  { nameEn: 'MikroTik', nameFa: 'میکروتیک', icon: '🌐', color: '#c03030', count: 8 },
  { nameEn: 'Cisco', nameFa: 'سیسکو', icon: '🔷', color: '#1ba0d7', count: 6 },
  { nameEn: 'Linux', nameFa: 'لینوکس', icon: '🐧', color: '#f59e0b', count: 12 },
  { nameEn: 'Windows Server', nameFa: 'ویندوز سرور', icon: '🪟', color: '#00adef', count: 5 },
  { nameEn: 'VMware', nameFa: 'VMware', icon: '☁️', color: '#60b6e0', count: 7 },
  { nameEn: 'Proxmox', nameFa: 'Proxmox', icon: '🖥️', color: '#e57000', count: 4 },
  { nameEn: 'Security', nameFa: 'امنیت', icon: '🛡️', color: '#ef4444', count: 9 },
  { nameEn: 'Monitoring', nameFa: 'پایش', icon: '📊', color: '#f59e0b', count: 6 },
  { nameEn: 'Automation', nameFa: 'خودکارسازی', icon: '⚙️', color: '#06b6d4', count: 5 },
  { nameEn: 'DevOps', nameFa: 'دواپس', icon: '🚀', color: '#818cf8', count: 4 },
]

const FALLBACK_POSTS = [
  { titleEn: 'Building a Multi-Site MikroTik Network with OSPF', titleFa: 'ساخت شبکه چند سایته MikroTik با OSPF', categoryEn: 'MikroTik', categoryFa: 'میکروتیک', publishedAtEn: 'Jan 2025', publishedAtFa: 'دی ۱۴۰۳', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', excerptEn: 'A complete guide to designing and deploying multi-site OSPF routing with MikroTik RouterOS for enterprise branch offices.', excerptFa: 'راهنمای کامل طراحی و استقرار مسیریابی OSPF چند سایته با MikroTik RouterOS برای دفاتر شعبه سازمانی.', color: '#c03030' },
  { titleEn: 'Zero-Trust Network Architecture with Fortigate', titleFa: 'معماری شبکه Zero-Trust با Fortigate', categoryEn: 'Security', categoryFa: 'امنیت', publishedAtEn: 'Feb 2025', publishedAtFa: 'بهمن ۱۴۰۳', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', excerptEn: 'Implementing a zero-trust security model using Fortigate NGFW, SSL inspection, and micro-segmentation for enterprise environments.', excerptFa: 'پیاده‌سازی مدل امنیتی Zero-Trust با استفاده از Fortigate NGFW، بازرسی SSL و میکرو-تقسیم‌بندی برای محیط‌های سازمانی.', color: '#ef4444' },
  { titleEn: 'Proxmox VE Cluster Setup for Production Workloads', titleFa: 'راه‌اندازی کلاستر Proxmox VE برای بارکارهای تولیدی', categoryEn: 'Proxmox', categoryFa: 'Proxmox', publishedAtEn: 'Mar 2025', publishedAtFa: 'اسفند ۱۴۰۳', readTimeEn: '18 min read', readTimeFa: '۱۸ دقیقه مطالعه', excerptEn: 'Step-by-step guide to building a 3-node Proxmox cluster with Ceph storage, HA failover, and live migration for production VMs.', excerptFa: 'راهنمای گام به گام ساخت کلاستر ۳ نودی Proxmox با ذخیره‌سازی Ceph، Failover HA و Live Migration برای VM‌های تولیدی.', color: '#e57000' },
  { titleEn: 'Zabbix 7.0 Advanced Monitoring: Custom Dashboards', titleFa: 'پایش پیشرفته Zabbix 7.0: داشبوردهای اختصاصی', categoryEn: 'Monitoring', categoryFa: 'پایش', publishedAtEn: 'Apr 2025', publishedAtFa: 'فروردین ۱۴۰۴', readTimeEn: '10 min read', readTimeFa: '۱۰ دقیقه مطالعه', excerptEn: 'Creating enterprise-grade Zabbix dashboards with custom metrics, triggers, and Grafana integration for infrastructure visibility.', excerptFa: 'ساخت داشبوردهای سطح سازمانی در Zabbix با متریک‌های اختصاصی، ترایگرها و یکپارچه‌سازی Grafana برای دید زیرساختی.', color: '#f59e0b' },
  { titleEn: 'Ansible for Network Automation: MikroTik & Cisco', titleFa: 'Ansible برای خودکارسازی شبکه: MikroTik و Cisco', categoryEn: 'Automation', categoryFa: 'خودکارسازی', publishedAtEn: 'May 2025', publishedAtFa: 'اردیبهشت ۱۴۰۴', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', excerptEn: 'Automating network device configuration with Ansible: real playbooks for MikroTik RouterOS and Cisco IOS environments.', excerptFa: 'خودکارسازی پیکربندی تجهیزات شبکه با Ansible: Playbook‌های واقعی برای MikroTik RouterOS و Cisco IOS.', color: '#06b6d4' },
  { titleEn: 'Linux Server Hardening: Production Security Checklist', titleFa: 'سخت‌سازی سرور لینوکس: چک‌لیست امنیتی تولیدی', categoryEn: 'Linux', categoryFa: 'لینوکس', publishedAtEn: 'Jun 2025', publishedAtFa: 'خرداد ۱۴۰۴', readTimeEn: '16 min read', readTimeFa: '۱۶ دقیقه مطالعه', excerptEn: 'Comprehensive security hardening checklist for Linux production servers: SSH, firewall, audit, SELinux, and automated compliance.', excerptFa: 'چک‌لیست جامع سخت‌سازی امنیتی سرورهای لینوکس تولیدی: SSH، فایروال، Audit، SELinux و انطباق خودکار.', color: '#f59e0b' },
]

export default async function BlogPage({ params }: Props) {
  const { locale } = await params
  const isRTL = locale === 'fa'

  const [dbPosts, dbCategories] = await Promise.all([
    getPublicBlogPosts(),
    getPublicBlogCategories(),
  ])

  const categoryById = Object.fromEntries(dbCategories.map(c => [c.id, c]))

  const posts = dbPosts.length > 0
    ? dbPosts.map(p => {
        const cat = p.categoryId ? categoryById[p.categoryId] : null
        return {
          title: isRTL ? p.titleFa : p.titleEn,
          category: cat ? (isRTL ? cat.nameFa : cat.nameEn) : '',
          categoryDisplay: cat ? (isRTL ? cat.nameFa : cat.nameEn) : '',
          publishedAt: isRTL ? (p.publishedAtFa || '') : (p.publishedAtEn || ''),
          readTime: isRTL ? (p.readTimeFa || '') : (p.readTimeEn || ''),
          excerpt: isRTL ? (p.excerptFa || '') : (p.excerptEn || ''),
          color: cat?.color || '#6366f1',
          slug: p.slug,
        }
      })
    : FALLBACK_POSTS.map(p => ({
        title: isRTL ? p.titleFa : p.titleEn,
        category: isRTL ? p.categoryFa : p.categoryEn,
        categoryDisplay: isRTL ? p.categoryFa : p.categoryEn,
        publishedAt: isRTL ? p.publishedAtFa : p.publishedAtEn,
        readTime: isRTL ? p.readTimeFa : p.readTimeEn,
        excerpt: isRTL ? p.excerptFa : p.excerptEn,
        color: p.color,
        slug: null,
      }))

  const categories = dbCategories.length > 0
    ? dbCategories.map(c => ({
        name: isRTL ? c.nameFa : c.nameEn,
        icon: c.icon || '📁',
        color: c.color || '#6366f1',
        count: 0,
      }))
    : FALLBACK_CATEGORIES_EN.map(c => ({
        name: isRTL ? c.nameFa : c.nameEn,
        icon: c.icon,
        color: c.color,
        count: c.count,
      }))

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
              {categories.map((cat) => (
                <div
                  key={cat.name}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer hover:scale-105 transition-transform"
                  style={{ background: `${cat.color}15`, border: `1px solid ${cat.color}30` }}
                >
                  <span>{cat.icon}</span>
                  <span className="text-sm font-medium" style={{ color: cat.color }}>{cat.name}</span>
                  {cat.count > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${cat.color}20`, color: cat.color }}>
                      {cat.count}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Posts */}
          <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-6">
            {isRTL ? 'آخرین مقالات' : 'Latest Articles'}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, i) => (
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
                    {post.category || post.categoryDisplay}
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
                  <span className="text-xs text-text-muted">{post.publishedAt}</span>
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
