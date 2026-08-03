import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AiAssistant } from '@/components/ai/AiAssistant'
import { loadPublicNav } from '@/lib/publicNav'

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function MarketingLayout({ children, params }: Props) {
  const { locale } = await params
  // 26.31 بند ۱ — the menu is loaded server-side from the DB, so what the
  // operator builds in /admin/menus is what visitors see. Falls back to the
  // built-in structure when the table is empty or unreachable (R4).
  const [headerNav, footerNav] = await Promise.all([
    loadPublicNav('header'),
    loadPublicNav('footer'),
  ])

  return (
    <>
      <Header locale={locale} nav={headerNav} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer locale={locale} nav={footerNav} />
      <AiAssistant locale={locale} />
    </>
  )
}
