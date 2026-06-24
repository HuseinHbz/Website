import { AboutSection } from '@/components/sections/AboutSection'
import { ClosingCta } from '@/components/sections/ClosingCta'
import { JsonLd } from '@/components/seo/JsonLd'
import { personSchema } from '@/lib/schema'
import { SITE } from '@/lib/site'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Husein Habibazar — Infrastructure Architect | HBZ',
  description: 'Learn about Husein Habibazar (HBZ): 10+ years of enterprise infrastructure, network architecture, and security consulting experience across Iran.',
  openGraph: {
    title: 'About Husein Habibazar — Infrastructure Architect',
    description: 'Senior Infrastructure Architect with 10+ years building enterprise-grade networks, security systems, and automated infrastructure.',
    url: `${SITE.url}/about`,
  },
}

interface Props {
  params: Promise<{ locale: string }>
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params

  return (
    <>
      <JsonLd schema={personSchema()} />
      <div className="pt-16">
        <AboutSection />
        <ClosingCta locale={locale} />
      </div>
    </>
  )
}
