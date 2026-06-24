import { ProjectsSection } from '@/components/sections/ProjectsSection'
import { ClosingCta } from '@/components/sections/ClosingCta'
import { SITE } from '@/lib/site'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Infrastructure Projects & Case Studies | HBZ',
  description: 'Real-world infrastructure case studies: Kenzo Restaurant, Popcorn Holding, Senso Restaurant Group, and industrial enterprise projects by Husein Habibazar.',
  openGraph: {
    title: 'Infrastructure Projects — HBZ Case Studies',
    description: 'Real enterprise infrastructure projects with measurable results.',
    url: `${SITE.url}/projects`,
  },
}

interface Props {
  params: Promise<{ locale: string }>
}

export default async function ProjectsPage({ params }: Props) {
  const { locale } = await params

  return (
    <div className="pt-16">
      <ProjectsSection />
      <ClosingCta locale={locale} />
    </div>
  )
}
