import type { Metadata } from 'next'
import { AiPlatform } from './AiPlatform'

export const metadata: Metadata = {
  title: 'HBZ AI Platform — Enterprise Technology Advisor',
  description: 'Intelligent guidance for infrastructure, networking, cloud, security, and enterprise architecture powered by HBZ Technology.',
}

interface Props {
  params: Promise<{ locale: string }>
}

export default async function AiPlatformPage({ params }: Props) {
  const { locale } = await params
  return <AiPlatform locale={locale as 'en' | 'fa'} />
}
