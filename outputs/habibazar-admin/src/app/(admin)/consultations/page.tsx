import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ConsultationsTable } from '@/components/consultations/ConsultationsTable'
import { ConsultationsFilter } from '@/components/consultations/ConsultationsFilter'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingTable } from '@/components/ui/LoadingTable'
import type { ConsultationRequest, Pagination } from '@/lib/types'

export const metadata = { title: 'Consultations' }

interface PageProps {
  searchParams: Promise<{ status?: string; kind?: string; page?: string }>
}

async function ConsultationsContent({
  token,
  status,
  kind,
  page,
}: {
  token: string
  status?: string
  kind?: string
  page?: string
}) {
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (kind) params.set('kind', kind)
  if (page) params.set('page', page)
  params.set('limit', '20')

  const res = await fetch(`${API}/api/v1/admin/consultations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')

  const json = await res.json()
  const consultations: ConsultationRequest[] = json.data || []
  const pagination: Pagination = json.pagination || {
    total: 0, page: 1, limit: 20, pages: 1, hasNext: false, hasPrev: false,
  }

  return <ConsultationsTable consultations={consultations} pagination={pagination} />
}

export default async function ConsultationsPage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const params = await searchParams

  return (
    <div className="space-y-6">
      <PageHeader title="Consultations" description="Manage consultation requests." />
      <Suspense fallback={null}>
        <ConsultationsFilter />
      </Suspense>
      <Suspense fallback={<div className="bg-surface border border-border rounded-xl overflow-hidden"><LoadingTable columns={7} /></div>}>
        <ConsultationsContent
          token={token}
          status={params.status}
          kind={params.kind}
          page={params.page}
        />
      </Suspense>
    </div>
  )
}
