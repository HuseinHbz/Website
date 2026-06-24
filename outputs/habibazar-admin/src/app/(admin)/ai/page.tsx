import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ConversationsList } from '@/components/ai/ConversationsList'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingTable } from '@/components/ui/LoadingTable'
import type { Conversation, Pagination } from '@/lib/types'

export const metadata = { title: 'AI Conversations' }

interface PageProps {
  searchParams: Promise<{ category?: string; locale?: string; page?: string }>
}

function AIFilter({ category, locale }: { category?: string; locale?: string }) {
  return (
    <form method="GET" className="flex flex-wrap gap-3">
      <input
        name="category"
        defaultValue={category}
        placeholder="Filter by category..."
        className="form-input w-auto text-sm py-1.5 min-w-[180px]"
      />
      <select
        name="locale"
        defaultValue={locale || ''}
        className="form-input w-auto text-sm py-1.5 cursor-pointer"
      >
        <option value="">All Locales</option>
        <option value="fa">Persian (fa)</option>
        <option value="en">English (en)</option>
      </select>
      <button
        type="submit"
        className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
      >
        Filter
      </button>
    </form>
  )
}

async function ConversationsContent({
  token,
  category,
  locale,
  page,
}: {
  token: string
  category?: string
  locale?: string
  page?: string
}) {
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (locale) params.set('locale', locale)
  if (page) params.set('page', page)
  params.set('limit', '25')

  const res = await fetch(`${API}/api/v1/admin/ai/conversations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')

  const json = await res.json()
  const conversations: Conversation[] = json.data || []
  const pagination: Pagination = json.pagination || {
    total: 0, page: 1, limit: 25, pages: 1, hasNext: false, hasPrev: false,
  }

  return <ConversationsList conversations={conversations} pagination={pagination} />
}

export default async function AIPage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const params = await searchParams

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Conversations"
        description="Monitor and review AI assistant conversations."
      />
      <AIFilter category={params.category} locale={params.locale} />
      <Suspense fallback={<div className="bg-surface border border-border rounded-xl overflow-hidden"><LoadingTable columns={7} /></div>}>
        <ConversationsContent
          token={token}
          category={params.category}
          locale={params.locale}
          page={params.page}
        />
      </Suspense>
    </div>
  )
}
