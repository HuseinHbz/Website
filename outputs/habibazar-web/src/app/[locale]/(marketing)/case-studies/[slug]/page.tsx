import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SITE } from '@/lib/site'
import { getPublicCaseStudyBySlug, getPublicRelatedCaseStudies, getPublicProjects } from '@/lib/publicData'
import { CaseStudyDetail } from './CaseStudyDetail'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
  const projects = await getPublicProjects()
  const locales = ['en', 'fa']
  return locales.flatMap(locale => projects.map(p => ({ locale, slug: p.slug })))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const project = await getPublicCaseStudyBySlug(slug)
  if (!project) return {}
  const isRTL = locale === 'fa'
  const title = isRTL
    ? (project.seoTitle || `${project.nameFa} | مطالعه موردی HBZ`)
    : (project.seoTitle || `${project.nameEn} | HBZ Enterprise Case Study`)
  const description = isRTL
    ? (project.seoDescription || project.executiveSummaryFa || project.challengeFa || '')
    : (project.seoDescription || project.executiveSummaryEn || project.challengeEn || '')

  return {
    title,
    description,
    keywords: project.seoKeywords || undefined,
    openGraph: {
      title,
      description,
      url: `${SITE.url}/${locale}/case-studies/${slug}`,
      images: project.ogImage || project.coverImage ? [{ url: project.ogImage || project.coverImage || '' }] : [],
    },
    alternates: {
      canonical: `${SITE.url}/${locale}/case-studies/${slug}`,
      languages: {
        en: `${SITE.url}/en/case-studies/${slug}`,
        fa: `${SITE.url}/fa/case-studies/${slug}`,
      },
    },
  }
}

export default async function CaseStudyPage({ params }: Props) {
  const { locale, slug } = await params
  const project = await getPublicCaseStudyBySlug(slug)
  if (!project) notFound()

  let relatedProjects: typeof project[] = []
  if (project.relatedCaseStudySlugs) {
    try {
      const slugs = JSON.parse(project.relatedCaseStudySlugs)
      if (Array.isArray(slugs) && slugs.length) {
        relatedProjects = await getPublicRelatedCaseStudies(slugs) as typeof project[]
      }
    } catch { /* ignore */ }
  }

  return <CaseStudyDetail locale={locale} project={project} relatedProjects={relatedProjects} />
}
