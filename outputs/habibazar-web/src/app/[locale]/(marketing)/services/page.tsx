import { ServicesSection } from '@/components/sections/ServicesSection'
import { ClosingCta } from '@/components/sections/ClosingCta'
import { SITE } from '@/lib/site'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Enterprise IT Services — Network, Security & Infrastructure | HBZ',
  description: 'Comprehensive infrastructure consulting services: network design, security, virtualization, monitoring, backup & DR, Linux, Microsoft, VoIP, and automation.',
  openGraph: {
    title: 'Enterprise IT Services by HBZ',
    description: 'End-to-end infrastructure consulting from design to deployment for enterprise clients.',
    url: `${SITE.url}/services`,
  },
}

interface Props {
  params: Promise<{ locale: string }>
}

export default async function ServicesPage({ params }: Props) {
  const { locale } = await params

  return (
    <div className="pt-16">
      <ServicesSection />
      <ClosingCta locale={locale} />
    </div>
  )
}
