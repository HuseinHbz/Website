import { SITE } from './site'

/** `nameOverride`/`alternateNameOverride` — Brand & Identity Settings
 *  (brandNameEn/brandNameFa). Optional and defaulted to SITE.* so every other
 *  existing caller (unchanged) still gets the exact prior output. */
export function personSchema(nameOverride?: string, alternateNameOverride?: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: nameOverride || SITE.owner,
    alternateName: alternateNameOverride || SITE.ownerFa,
    jobTitle: 'Infrastructure Architect & Network Security Consultant',
    description: 'Senior Infrastructure Architect with 10+ years of enterprise networking, security, and virtualization experience.',
    url: SITE.url,
    sameAs: [SITE.social.linkedin],
    knowsAbout: [
      'Enterprise Infrastructure',
      'Network Architecture',
      'Network Security',
      'MikroTik RouterOS',
      'Cisco Networking',
      'VMware vSphere',
      'Proxmox VE',
      'Linux Server Administration',
      'Fortigate Firewall',
      'Infrastructure Automation',
      'Zabbix Monitoring',
      'Disaster Recovery',
    ],
  }
}

export function organizationSchema(founderNameOverride?: string) {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'ProfessionalService'],
    name: SITE.name,
    alternateName: SITE.nameFa,
    url: SITE.url,
    founder: {
      '@type': 'Person',
      name: founderNameOverride || SITE.owner,
    },
    description: SITE.description.en,
    areaServed: 'IR',
    serviceType: 'Infrastructure Consulting',
    knowsAbout: [
      'Cloud Infrastructure',
      'Network Security',
      'Enterprise IT Consulting',
      'Network Architecture',
    ],
  }
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.url,
    inLanguage: ['fa', 'en'],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE.url}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export interface BreadcrumbItem {
  name: string
  url: string
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export interface FaqItem {
  question: string
  answer: string
}

export function faqSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export interface ArticleData {
  title: string
  description: string
  url: string
  datePublished: string
  dateModified?: string
  image?: string
}

/** The app stores timestamps as `tsNow()`'s "YYYY-MM-DD HH:MM:SS" (UTC, no
 *  offset marker) across every table — schema.org/Google's structured-data
 *  validator requires real ISO 8601 (`...T...Z`) for datePublished/
 *  dateModified, so this reconstructs it rather than passing the raw DB
 *  string straight into JSON-LD. Already-ISO input passes through unchanged. */
function toIso8601(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return `${value.replace(' ', 'T')}Z`
  return value
}

export function articleSchema(post: ArticleData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    url: post.url,
    datePublished: toIso8601(post.datePublished),
    dateModified: toIso8601(post.dateModified || post.datePublished),
    image: post.image || `${SITE.url}/og-image.png`,
    author: {
      '@type': 'Person',
      name: SITE.owner,
      url: SITE.url,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      url: SITE.url,
    },
  }
}

export function siteGraphSchema(nameOverride?: string, alternateNameOverride?: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [personSchema(nameOverride, alternateNameOverride), organizationSchema(nameOverride), websiteSchema()],
  }
}
