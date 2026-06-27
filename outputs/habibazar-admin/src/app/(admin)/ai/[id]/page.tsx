import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ConversationView } from '@/components/ai/ConversationView'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Conversation, Message } from '@/lib/types'

export const metadata = { title: 'AI Conversation' }

interface ConversationPageProps {
  params: Promise<{ id: string }>
}

export default async function ConversationDetailPage({ params }: ConversationPageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const { id } = await params
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'

  const res = await fetch(`${API}/api/v1/admin/ai/conversations/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')
  if (res.status === 404) notFound()

  const json = await res.json()
  const conversation: Conversation & { messages: Message[] } = json.data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/ai"
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <PageHeader
          title={conversation.name || 'Anonymous Conversation'}
          description={`Conversation #${id.slice(0, 8)}`}
        />
      </div>
      <ConversationView conversation={conversation} />
    </div>
  )
}
