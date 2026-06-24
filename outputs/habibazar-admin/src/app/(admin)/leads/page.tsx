import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { LeadsTable } from '@/components/leads/LeadsTable'
import { LeadsFilter } from '@/components/leads/LeadsFilter'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingTable } from '@/components/ui/LoadingTable'
import type { Lead, Pagination } from '@/lib/types'

export const metadata = { title: 'Leads' }

interface LeadsPageProps {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>
}

async function LeadsContent({
  token,
  status,
  search,
  page,
}: {
  token: string
  status?: string
  search?: string
  page?: string
}) {
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (search) params.set('search', search)
  if (page) params.set('page', page)
  params.set('limit', '20')

  const res = await fetch(`${API}/api/v1/admin/leads?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')

  const json = await res.json()
  const leads: Lead[] = json.data || []
  const pagination: Pagination = json.pagination || {
    total: 0, page: 1, limit: 20, pages: 1, hasNext: false, hasPrev: false,
  }

  return <LeadsTable leads={leads} pagination={pagination} />
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const params = await searchParams

  return (
    <div className="space-y-6">
      <PageHeader title="Leads" description="Manage and track all leads." />
      <Suspense fallback={null}>
        <LeadsFilter />
      </Suspense>
      <Suspense fallback={<div className="bg-surface border border-border rounded-xl overflow-hidden"><LoadingTable columns={8} /></div>}>
        <LeadsContent
          token={token}
          status={params.status}
          search={params.search}
          page={params.page}
        />
      </Suspense>
    </div>
  )
}
