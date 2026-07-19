import type { Metadata } from 'next'
import { PortalApp } from './PortalApp'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'HBZ — پرتال مشتری' }

interface Props { params: Promise<{ locale: string }> }

// Customer Portal (Phase 26.25a). Public, authenticated via an INDEPENDENT
// OTP session (never the admin JWT). noindex. The client app fetches everything
// from /api/portal/* — every response is scoped to the server session.
export default async function PortalPage({ params }: Props) {
  const { locale } = await params
  return <PortalApp locale={locale === 'fa' ? 'fa' : 'en'} />
}
