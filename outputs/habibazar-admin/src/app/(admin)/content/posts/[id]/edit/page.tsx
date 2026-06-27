import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { PostFormClient } from './PostFormClient'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Post } from '@/lib/types'

export const metadata = { title: 'Edit Post' }

interface EditPostPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const { id } = await params
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'

  const res = await fetch(`${API}/api/v1/admin/content/posts/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')
  if (res.status === 404) notFound()

  const json = await res.json()
  const post: Post = json.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Post"
        description={post.titleEn || post.titleFa}
      />
      <div className="bg-surface border border-border rounded-xl p-6">
        <PostFormClient post={post} />
      </div>
    </div>
  )
}
