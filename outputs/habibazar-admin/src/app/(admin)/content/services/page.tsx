import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ContentTable } from '@/components/content/ContentTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import type { Service } from '@/lib/types'

export const metadata = { title: 'Services' }

async function ServicesContent({ token }: { token: string }) {
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
  const res = await fetch(`${API}/api/v1/admin/content/services?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')

  const json = await res.json()
  const services: Service[] = json.data || []

  const items = services.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.titleEn || s.titleFa,
    status: s.status,
    updatedAt: s.createdAt,
  }))

  async function handleDelete(id: string) {
    'use server'
    const cookieStore = await cookies()
    const t = cookieStore.get('access_token')?.value
    if (!t) return
    const APIURL = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
    await fetch(`${APIURL}/api/v1/admin/content/services/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${t}` },
    })
  }

  return (
    <ContentTable
      items={items}
      onDelete={handleDelete}
      editHref={(id) => `/content/services/${id}/edit`}
    />
  )
}

export default async function ServicesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Manage service offerings."
        action={
          <Link href="/content/services/new">
            <Button>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Service
            </Button>
          </Link>
        }
      />
      <ServicesContent token={token} />
    </div>
  )
}
