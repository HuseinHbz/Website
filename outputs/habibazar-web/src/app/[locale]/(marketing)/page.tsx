import { Hero } from '@/components/sections/Hero'
import { ProofBar } from '@/components/sections/ProofBar'
import { ServicesSnapshot } from '@/components/sections/ServicesSnapshot'
import { TheMethod } from '@/components/sections/TheMethod'
import { FeaturedCases } from '@/components/sections/FeaturedCases'
import { TrustSignals } from '@/components/sections/TrustSignals'
import { AiTeaser } from '@/components/sections/AiTeaser'
import { ClosingCta } from '@/components/sections/ClosingCta'
import { JsonLd } from '@/components/seo/JsonLd'
import { siteGraphSchema } from '@/lib/schema'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params

  return (
    <>
      <JsonLd schema={siteGraphSchema()} />
      <Hero locale={locale} />
      <ProofBar locale={locale} />
      <ServicesSnapshot locale={locale} />
      <TheMethod locale={locale} />
      <FeaturedCases locale={locale} />
      <TrustSignals locale={locale} />
      <AiTeaser locale={locale} />
      <ClosingCta locale={locale} />
    </>
  )
}
