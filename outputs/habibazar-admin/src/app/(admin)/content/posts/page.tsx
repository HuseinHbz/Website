import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ContentTable } from '@/components/content/ContentTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import type { Post } from '@/lib/types'

export const metadata = { title: 'Posts' }

async function PostsContent({ token }: { token: string }) {
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
  const res = await fetch(`${API}/api/v1/admin/content/posts?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')

  const json = await res.json()
  const posts: Post[] = json.data || []

  const items = posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.titleEn || p.titleFa,
    status: p.status,
    updatedAt: p.updatedAt,
  }))

  async function handleDelete(id: string) {
    'use server'
    const cookieStore = await cookies()
    const t = cookieStore.get('access_token')?.value
    if (!t) return
    const APIURL = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
    await fetch(`${APIURL}/api/v1/admin/content/posts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${t}` },
    })
  }

  return (
    <ContentTable
      items={items}
      onDelete={handleDelete}
      editHref={(id) => `/content/posts/${id}/edit`}
    />
  )
}

export default async function PostsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Posts"
        description="Manage blog posts and articles."
        action={
          <Link href="/content/posts/new">
            <Button>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Post
            </Button>
          </Link>
        }
      />
      <PostsContent token={token} />
    </div>
  )
}
