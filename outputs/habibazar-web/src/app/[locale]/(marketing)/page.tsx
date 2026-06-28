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
import {
  getPublicProjects,
  getPublicServices,
  getPublicSkills,
  getPublicCerts,
  getPublicClients,
  getPublicTimeline,
  getPublicAbout,
} from '@/lib/publicData'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params

  const [dbProjects, dbServices, dbSkills, dbCerts, dbClients, dbTimeline, dbAbout] = await Promise.all([
    getPublicProjects(),
    getPublicServices(),
    getPublicSkills(),
    getPublicCerts(),
    getPublicClients(),
    getPublicTimeline(),
    getPublicAbout(locale),
  ])

  return (
    <>
      <JsonLd schema={siteGraphSchema()} />
      <Hero locale={locale} />
      <ProofBar locale={locale} />
      <ServicesSection locale={locale} dbServices={dbServices} />
      <ProjectsSection locale={locale} dbProjects={dbProjects} />
      <AboutSection locale={locale} dbAbout={dbAbout} dbTimeline={dbTimeline} dbSkills={dbSkills} dbCerts={dbCerts} />
      <CompanyPortfolio locale={locale} dbClients={dbClients} />
      <AiTeaser locale={locale} />
      <ClosingCta locale={locale} />
    </>
  )
}
