export const dynamic = 'force-dynamic'

import { headers, cookies } from 'next/headers'
import { Hero } from '@/components/sections/Hero'
import { HeroExperience } from '@/components/sections/HeroExperience'
import { resolveActiveHero } from '@/lib/hero/heroData'
import type { RequestContext } from '@/lib/hero/personalize'
import { EnterpriseMetrics } from '@/components/sections/EnterpriseMetrics'
import { ServicesSection } from '@/components/sections/ServicesSection'
import { ProjectsSection } from '@/components/sections/ProjectsSection'
import { AboutSection } from '@/components/sections/AboutSection'
import { CompanyPortfolio } from '@/components/sections/CompanyPortfolio'
import { TestimonialsSection } from '@/components/sections/TestimonialsSection'
import { AiTeaser } from '@/components/sections/AiTeaser'
import { ClosingCta } from '@/components/sections/ClosingCta'
import { JsonLd } from '@/components/seo/JsonLd'
import { siteGraphSchema } from '@/lib/schema'
import {
  getPublicHero,
  getPublicProjects,
  getPublicServices,
  getPublicSkills,
  getPublicCerts,
  getPublicClients,
  getPublicTestimonials,
  getPublicTimeline,
  getPublicAbout,
  getPublicSetting,
} from '@/lib/publicData'

interface Props {
  params: Promise<{ locale: string }>
}

/** Resolve a published Phase-23 hero for the home path (A/B + personalization),
 * building the request context from headers/cookies. Never throws — a failure
 * simply falls back to the legacy Hero. */
async function resolvePhase23Hero(locale: string) {
  try {
    const h = await headers()
    const ck = await cookies()
    const ua = (h.get('user-agent') ?? '').toLowerCase()
    const device: RequestContext['device'] = /mobile|iphone|android.*mobile/.test(ua) ? 'mobile' : /ipad|tablet|android/.test(ua) ? 'tablet' : 'desktop'
    const now = new Date()
    const ctx: RequestContext = {
      device,
      locale: (locale === 'fa' ? 'fa' : 'en'),
      country: h.get('x-vercel-ip-country') ?? h.get('cf-ipcountry') ?? undefined,
      returning: !!ck.get('visited'),
      loggedIn: !!ck.get('admin_token'),
      referral: (() => { try { return new URL(h.get('referer') ?? '').host } catch { return undefined } })(),
      hour: now.getHours(),
      weekday: now.getDay(),
    }
    const subject = ck.get('hbz_uid')?.value ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'
    return await resolveActiveHero('/', ctx, subject)
  } catch { return null }
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params

  const [dbProjects, dbServices, dbSkills, dbCerts, dbClients, dbTimeline, dbAbout, dbHero, heroVariant, dbTestimonials] = await Promise.all([
    getPublicProjects(),
    getPublicServices(),
    getPublicSkills(),
    getPublicCerts(),
    getPublicClients(),
    getPublicTimeline(),
    getPublicAbout(locale),
    getPublicHero(locale),
    getPublicSetting('hero_variant'),
    getPublicTestimonials(),
  ])

  const active = await resolvePhase23Hero(locale)

  return (
    <>
      <JsonLd schema={siteGraphSchema()} />
      <div className="home-enterprise">
        {active
          ? <HeroExperience heroId={active.hero.id} config={active.hero.config} locale={locale as 'fa' | 'en'} experimentKey={active.experimentKey} variantId={active.variantId} />
          : <Hero locale={locale} dbHero={dbHero} variant={heroVariant || 'split'} />}
        <EnterpriseMetrics locale={locale} />
        <ServicesSection locale={locale} dbServices={dbServices} />
        <ProjectsSection locale={locale} dbProjects={dbProjects} />
        <AboutSection locale={locale} dbAbout={dbAbout} dbTimeline={dbTimeline} dbSkills={dbSkills} dbCerts={dbCerts} />
        <CompanyPortfolio locale={locale} dbClients={dbClients} />
        {/* 26.31 بند ۵ — testimonials out of their double-hidden solutions page */}
        <TestimonialsSection locale={locale} items={dbTestimonials} />
        <AiTeaser locale={locale} />
        <ClosingCta locale={locale} />
      </div>
    </>
  )
}
