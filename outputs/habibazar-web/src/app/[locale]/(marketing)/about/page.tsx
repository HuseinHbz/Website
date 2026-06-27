import { AboutSection } from '@/components/sections/AboutSection'
import { ClosingCta } from '@/components/sections/ClosingCta'
import { JsonLd } from '@/components/seo/JsonLd'
import { personSchema } from '@/lib/schema'
import { SITE } from '@/lib/site'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const isRTL = locale === 'fa'
  return {
    title: isRTL
      ? 'درباره حسین حبیب‌آذر — معمار زیرساخت | HBZ'
      : 'About Husein Habibazar — Infrastructure Architect | HBZ',
    description: isRTL
      ? 'آشنایی با حسین حبیب‌آذر (HBZ): بیش از ۱۰ سال تجربه در زیرساخت سازمانی، معماری شبکه و مشاوره امنیت.'
      : 'Learn about Husein Habibazar (HBZ): 10+ years of enterprise infrastructure, network architecture, and security consulting experience.',
    openGraph: {
      url: `${SITE.url}/${locale}/about`,
    },
  }
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
        <AboutSection locale={locale} />
        <ClosingCta locale={locale} />
      </div>
    </>
  )
}
