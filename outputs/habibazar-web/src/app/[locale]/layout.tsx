import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { cn } from '@/lib/utils'
import { SITE } from '@/lib/site'
import { AnalyticsTracker } from '@/components/AnalyticsTracker'
import { ThemeProvider } from '@/components/ds/ThemeProvider'
import { ToastProvider } from '@/components/ds/Toast'
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

  const isFA = locale === 'fa'
  const canonicalUrl =
    SITE.url + (isFA ? '' : `/${locale}`)

  return {
    metadataBase: new URL(SITE.url),
    title: {
      default: t('homeTitle'),
      template: `%s | ${SITE.name}`,
    },
    description: t('homeDesc'),
    authors: [{ name: SITE.owner, url: SITE.url }],
    creator: SITE.owner,
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
      title: t('homeTitle'),
      description: t('homeDesc'),
      images: [
        {
          url: `${SITE.url}/og-image.png`,
          width: 1200,
          height: 630,
          alt: SITE.owner,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('homeTitle'),
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
        isRTL ? 'font-persian' : 'font-sans',
        'scroll-smooth'
      )}
    >
      <head>
        {isRTL && (
          <link
            href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100;200;300;400;500;600;700;800;900&display=swap"
            rel="stylesheet"
          />
        )}
        <style>{`
          :root {
            --font-persian: ${isRTL ? "'Vazirmatn', Tahoma, Arial, sans-serif" : 'inherit'};
          }
        `}</style>
      </head>
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
