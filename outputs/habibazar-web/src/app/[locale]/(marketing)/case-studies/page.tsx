import type { Metadata } from 'next'
import { SITE } from '@/lib/site'
import { getPublicProjects } from '@/lib/publicData'
import { CaseStudiesListing } from './CaseStudiesListing'
import { ClosingCta } from '@/components/sections/ClosingCta'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const isRTL = locale === 'fa'
  return {
    title: isRTL
      ? 'مطالعات موردی سازمانی | HBZ Technology'
      : 'Enterprise Case Studies | HBZ Technology',
    description: isRTL
      ? 'مطالعات موردی واقعی از تحول زیرساخت سازمانی: شبکه، امنیت، مجازی‌سازی، پایش و خودکارسازی.'
      : 'Real-world enterprise infrastructure case studies: networking, security, virtualization, monitoring, and automation transformations by HBZ.',
    openGraph: {
      url: `${SITE.url}/${locale}/case-studies`,
    },
    alternates: {
      canonical: `${SITE.url}/${locale}/case-studies`,
      languages: {
        en: `${SITE.url}/en/case-studies`,
        fa: `${SITE.url}/fa/case-studies`,
      },
    },
  }
}

export default async function CaseStudiesPage({ params }: Props) {
  const { locale } = await params
  const projects = await getPublicProjects()

  return (
    <div className="pt-16">
      <CaseStudiesListing locale={locale} projects={projects} />
      <ClosingCta locale={locale} />
    </div>
  )
}
