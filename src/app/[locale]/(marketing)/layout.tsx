import { MotionConfig } from 'framer-motion'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AiAssistant } from '@/components/ai/AiAssistant'
import { loadPublicNav } from '@/lib/publicNav'
import { getBrandSettings, versionedLogoUrl } from '@/lib/branding/settings'

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function MarketingLayout({ children, params }: Props) {
  const { locale } = await params
  // 26.31 بند ۱ — the menu is loaded server-side from the DB, so what the
  // operator builds in /admin/menus is what visitors see. Falls back to the
  // built-in structure when the table is empty or unreachable (R4).
  const [headerNav, footerNav, brandSettings] = await Promise.all([
    loadPublicNav('header'),
    loadPublicNav('footer'),
    getBrandSettings(),
  ])
  const isFA = locale === 'fa'
  // Resolved once, server-side, into the shape Header/Footer actually render
  // — the ONE central identity read for this whole page tree (getBrandSettings
  // is request-memoized, so [locale]/layout.tsx's own call above didn't
  // re-query either).
  const brand = {
    name: isFA ? brandSettings.brandNameFa : brandSettings.brandNameEn,
    subtitle: isFA ? brandSettings.brandSubtitleFa : brandSettings.brandSubtitleEn,
    logoUrl: versionedLogoUrl(brandSettings),
    logoAlt: isFA ? brandSettings.logoAltFa : brandSettings.logoAltEn,
  }

  return (
    // Premium-enterprise theme scope (globals.css `.hbz-marketing`) + a single
    // MotionConfig so every framer-motion animation on the public site — Hero
    // through Footer — respects the OS-level prefers-reduced-motion setting
    // without each component having to check it individually.
    <MotionConfig reducedMotion="user">
      <div className="hbz-marketing">
        <Header locale={locale} nav={headerNav} brand={brand} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} nav={footerNav} brand={brand} />
        <AiAssistant locale={locale} />
      </div>
    </MotionConfig>
  )
}
