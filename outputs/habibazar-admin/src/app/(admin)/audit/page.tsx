import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AuditTable } from '@/components/audit/AuditTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingTable } from '@/components/ui/LoadingTable'
import type { AuditLog, Pagination } from '@/lib/types'

export const metadata = { title: 'Audit Log' }

interface PageProps {
  searchParams: Promise<{
    resource?: string
    page?: string
    from?: string
    to?: string
  }>
}

function AuditFilter({
  resource,
  from,
  to,
}: {
  resource?: string
  from?: string
  to?: string
}) {
  return (
    <form method="GET" className="flex flex-wrap gap-3">
      <input
        name="resource"
        defaultValue={resource}
        placeholder="Filter by resource..."
        className="form-input w-auto text-sm py-1.5 min-w-[180px]"
      />
      <input
        name="from"
        type="date"
        defaultValue={from}
        className="form-input w-auto text-sm py-1.5"
      />
      <input
        name="to"
        type="date"
        defaultValue={to}
        className="form-input w-auto text-sm py-1.5"
      />
      <button
        type="submit"
        className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
      >
        Filter
      </button>
    </form>
  )
}

async function AuditContent({
  token,
  resource,
  page,
  from,
  to,
}: {
  token: string
  resource?: string
  page?: string
  from?: string
  to?: string
}) {
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
  const params = new URLSearchParams()
  if (resource) params.set('resource', resource)
  if (page) params.set('page', page)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  params.set('limit', '25')

  const res = await fetch(`${API}/api/v1/admin/audit?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')

  const json = await res.json()
  const logs: AuditLog[] = json.data || []
  const pagination: Pagination = json.pagination || {
    total: 0, page: 1, limit: 25, pages: 1, hasNext: false, hasPrev: false,
  }

  return <AuditTable logs={logs} pagination={pagination} />
}

export default async function AuditPage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const params = await searchParams

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Track all administrative actions."
      />
      <AuditFilter resource={params.resource} from={params.from} to={params.to} />
      <Suspense fallback={<div className="bg-surface border border-border rounded-xl overflow-hidden"><LoadingTable columns={6} /></div>}>
        <AuditContent
          token={token}
          resource={params.resource}
          page={params.page}
          from={params.from}
          to={params.to}
        />
      </Suspense>
    </div>
  )
}
