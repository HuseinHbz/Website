import type { Metadata } from 'next'
import { HrPortalApp } from './HrPortalApp'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'HBZ — پورتال کارمند' }

interface Props { params: Promise<{ locale: string }> }

// Employee Portal (Phase 28.4). Public, authenticated via an INDEPENDENT OTP
// session — its own cookie/table, never the customer portal_token or the
// admin JWT. noindex. Every response is scoped to the server session.
export default async function HrPortalPage({ params }: Props) {
  const { locale } = await params
  return <HrPortalApp locale={locale === 'fa' ? 'fa' : 'en'} />
}
