import { AboutSection } from '@/components/sections/AboutSection'
import { ClosingCta } from '@/components/sections/ClosingCta'
import { JsonLd } from '@/components/seo/JsonLd'
import { personSchema } from '@/lib/schema'
import { SITE } from '@/lib/site'
import type { Metadata } from 'next'
import { getPublicAbout, getPublicTimeline, getPublicSkills, getPublicCerts, getPublicSetting } from '@/lib/publicData'

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
  const [dbAbout, dbTimeline, dbSkills, dbCerts,
    contactEmail, contactPhone, contactLocationEn, contactLocationFa,
    socialLinkedin, socialGithub, socialTwitter, socialInstagram, socialTelegram, socialWhatsapp,
  ] = await Promise.all([
    getPublicAbout(locale),
    getPublicTimeline(),
    getPublicSkills(),
    getPublicCerts(),
    getPublicSetting('contact_email'),
    getPublicSetting('contact_phone'),
    getPublicSetting('contact_location_en'),
    getPublicSetting('contact_location_fa'),
    getPublicSetting('social_linkedin'),
    getPublicSetting('social_github'),
    getPublicSetting('social_twitter'),
    getPublicSetting('social_instagram'),
    getPublicSetting('social_telegram'),
    getPublicSetting('social_whatsapp'),
  ])

  const contactInfo = {
    email: contactEmail,
    phone: contactPhone,
    locationEn: contactLocationEn,
    locationFa: contactLocationFa,
  }

  const socialLinks = {
    linkedin: socialLinkedin,
    github: socialGithub,
    twitter: socialTwitter,
    instagram: socialInstagram,
    telegram: socialTelegram,
    whatsapp: socialWhatsapp,
    email: contactEmail,
  }

  return (
    <>
      <JsonLd schema={personSchema()} />
      <div className="pt-16">
        <AboutSection
          locale={locale}
          dbAbout={dbAbout}
          dbTimeline={dbTimeline}
          dbSkills={dbSkills}
          dbCerts={dbCerts}
          contactInfo={contactInfo}
          socialLinks={socialLinks}
        />
        <ClosingCta locale={locale} />
      </div>
    </>
  )
}
