import { Hero } from '@/components/sections/Hero'
import { ProofBar } from '@/components/sections/ProofBar'
import { ServicesSection } from '@/components/sections/ServicesSection'
import { ProjectsSection } from '@/components/sections/ProjectsSection'
import { AboutSection } from '@/components/sections/AboutSection'
import { CompanyPortfolio } from '@/components/sections/CompanyPortfolio'
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
      <ServicesSection locale={locale} />
      <ProjectsSection locale={locale} />
      <AboutSection locale={locale} />
      <CompanyPortfolio locale={locale} />
      <AiTeaser locale={locale} />
      <ClosingCta locale={locale} />
    </>
  )
}
