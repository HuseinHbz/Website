import { ServicesSection } from '@/components/sections/ServicesSection'
import { ClosingCta } from '@/components/sections/ClosingCta'
import { SITE } from '@/lib/site'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const isRTL = locale === 'fa'
  return {
    title: isRTL
      ? 'خدمات IT سازمانی — شبکه، امنیت و زیرساخت | HBZ'
      : 'Enterprise IT Services — Network, Security & Infrastructure | HBZ',
    description: isRTL
      ? 'خدمات جامع مشاوره زیرساخت: طراحی شبکه، امنیت، مجازی‌سازی، پایش، پشتیبان‌گیری، لینوکس، مایکروسافت، VoIP و خودکارسازی.'
      : 'Comprehensive infrastructure consulting services: network design, security, virtualization, monitoring, backup & DR, Linux, Microsoft, VoIP, and automation.',
    openGraph: {
      url: `${SITE.url}/${locale === SITE.locale.default ? '' : locale + '/'}services`,
    },
  }
}

interface Props {
  params: Promise<{ locale: string }>
}

export default async function ServicesPage({ params }: Props) {
  const { locale } = await params

  return (
    <div className="pt-16">
      <ServicesSection locale={locale} />
      <ClosingCta locale={locale} />
    </div>
  )
}
