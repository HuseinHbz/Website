import { SITE } from './site'

export function personSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: SITE.owner,
    alternateName: SITE.ownerFa,
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

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'ProfessionalService'],
    name: SITE.name,
    alternateName: SITE.nameFa,
    url: SITE.url,
    founder: {
      '@type': 'Person',
      name: SITE.owner,
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

export function articleSchema(post: ArticleData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    url: post.url,
    datePublished: post.datePublished,
    dateModified: post.dateModified || post.datePublished,
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

export function siteGraphSchema() {
  return {
    '@context': 'https://schema.org',
    '@graph': [personSchema(), organizationSchema(), websiteSchema()],
  }
}
