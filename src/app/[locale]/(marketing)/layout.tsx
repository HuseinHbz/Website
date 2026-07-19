import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AiAssistant } from '@/components/ai/AiAssistant'

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function MarketingLayout({ children, params }: Props) {
  const { locale } = await params

  return (
    <>
      <Header locale={locale} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer locale={locale} />
      <AiAssistant locale={locale} />
    </>
  )
}
