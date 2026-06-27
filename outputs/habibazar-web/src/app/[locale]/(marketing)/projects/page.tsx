import { ProjectsSection } from '@/components/sections/ProjectsSection'
import { ClosingCta } from '@/components/sections/ClosingCta'
import { SITE } from '@/lib/site'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const isRTL = locale === 'fa'
  return {
    title: isRTL
      ? 'پروژه‌ها و مطالعات موردی زیرساخت | HBZ'
      : 'Infrastructure Projects & Case Studies | HBZ',
    description: isRTL
      ? 'پروژه‌های واقعی زیرساخت: رستوران کنزو، هلدینگ پاپ‌کورن، گروه رستوران سنسو و پروژه‌های صنعتی توسط حسین حبیب‌آذر.'
      : 'Real-world infrastructure case studies: Kenzo Restaurant, Popcorn Holding, Senso Restaurant Group, and industrial enterprise projects by Husein Habibazar.',
    openGraph: {
      url: `${SITE.url}/${locale}/projects`,
    },
  }
}

interface Props {
  params: Promise<{ locale: string }>
}

export default async function ProjectsPage({ params }: Props) {
  const { locale } = await params

  return (
    <div className="pt-16">
      <ProjectsSection locale={locale} />
      <ClosingCta locale={locale} />
    </div>
  )
}
