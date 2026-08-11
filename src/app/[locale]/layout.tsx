import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { persianFontVars } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { SITE } from '@/lib/site'
import { AnalyticsTracker } from '@/components/AnalyticsTracker'
import { ThemeProvider } from '@/components/ds/ThemeProvider'
import { ToastProvider } from '@/components/ds/Toast'
import { getBrandSettings, resolveTitleTemplate, versionedLogoUrl } from '@/lib/branding/settings'
import '../globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const locales = ['fa', 'en'] as const
type Locale = (typeof locales)[number]

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo' })
  const brand = await getBrandSettings()

  const isFA = locale === 'fa'
  const canonicalUrl =
    SITE.url + (isFA ? '' : `/${locale}`)

  // homepage_title_{fa,en} → the browser tab title on / and /en; empty
  // falls back to the pre-existing next-intl translation (R4, no visible
  // change before a first edit). Internal pages inherit `template` below.
  const homeTitle = (isFA ? brand.homepageTitleFa : brand.homepageTitleEn) || t('homeTitle')
  const ownerName = isFA ? brand.brandNameFa : brand.brandNameEn
  const logo = versionedLogoUrl(brand)

  return {
    metadataBase: new URL(SITE.url),
    icons: logo
      ? { icon: [{ url: logo }], apple: logo, shortcut: logo }
      : { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }], apple: '/favicon.svg' },
    title: {
      default: homeTitle,
      template: resolveTitleTemplate(brand, locale),
    },
    description: t('homeDesc'),
    authors: [{ name: ownerName, url: SITE.url }],
    creator: ownerName,
    // publisher/og:site_name stay the short org name (SITE.name, "HBZ") —
    // a distinct concept from the person/brand name field above, and not
    // one of the fields this feature makes editable, so its default must
    // not shift just because brandName does.
    publisher: SITE.name,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        fa: SITE.url,
        en: `${SITE.url}/en`,
      },
    },
    openGraph: {
      type: 'website',
      locale: isFA ? 'fa_IR' : 'en_US',
      alternateLocale: isFA ? 'en_US' : 'fa_IR',
      url: canonicalUrl,
      siteName: SITE.name,
      title: homeTitle,
      description: t('homeDesc'),
      images: [
        {
          url: `${SITE.url}/og-image.png`,
          width: 1200,
          height: 630,
          alt: ownerName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: homeTitle,
      description: t('homeDesc'),
      images: [`${SITE.url}/og-image.png`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function RootLayout({ children, params }: Props) {
  const { locale } = await params

  if (!locales.includes(locale as Locale)) {
    notFound()
  }

  const messages = await getMessages()
  const isRTL = locale === 'fa'

  return (
    <html
      lang={locale}
      dir={isRTL ? 'rtl' : 'ltr'}
      className={cn(
        inter.variable,
        jetbrainsMono.variable,
        persianFontVars,
        isRTL ? 'font-persian' : 'font-sans',
        'scroll-smooth'
      )}
    >
      <body
        className={cn(
          'bg-background text-text-primary antialiased min-h-dvh',
          isRTL ? 'font-persian' : 'font-sans'
        )}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-brand"
        >
          {isRTL ? 'رفتن به محتوا' : 'Skip to content'}
        </a>
        <ThemeProvider>
          <ToastProvider>
            <NextIntlClientProvider messages={messages}>
              <AnalyticsTracker locale={locale} />
              {children}
            </NextIntlClientProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
