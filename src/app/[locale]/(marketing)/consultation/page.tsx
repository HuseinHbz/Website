import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ConsultationForm } from '@/components/forms/ConsultationForm'
import { JsonLd } from '@/components/seo/JsonLd'
import { breadcrumbSchema } from '@/lib/schema'
import { SITE } from '@/lib/site'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo' })

  return {
    title: t('consultationTitle'),
    description: t('consultationDesc'),
    alternates: {
      canonical: `${SITE.url}/consultation`,
      languages: {
        fa: `${SITE.url}/consultation`,
        en: `${SITE.url}/en/consultation`,
      },
    },
  }
}

export default async function ConsultationPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'consultation' })
  const isFA = locale === 'fa'

  const breadcrumb = breadcrumbSchema([
    { name: isFA ? 'خانه' : 'Home', url: SITE.url },
    {
      name: isFA ? 'مشاوره رایگان' : 'Free Consultation',
      url: `${SITE.url}/consultation`,
    },
  ])

  return (
    <>
      <JsonLd schema={breadcrumb} />
      <section className="section-padding">
        <div className="container-site">
          <div className="max-w-2xl mx-auto">
            <div className="mb-10 text-center">
              <p className="text-sm font-medium text-accent uppercase tracking-widest mb-3">
                {t('subtitle')}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
                {t('title')}
              </h1>
              <p className="text-text-secondary leading-relaxed">
                {t('description')}
              </p>
            </div>
            <ConsultationForm kind="ASSESSMENT" locale={locale} />
          </div>
        </div>
      </section>
    </>
  )
}
