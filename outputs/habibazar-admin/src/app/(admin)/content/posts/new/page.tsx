'use client'

import { useRouter } from 'next/navigation'
import { PostForm } from '@/components/content/PostForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { apiPost } from '@/lib/api'

export default function NewPostPage() {
  const router = useRouter()

  async function handleSubmit(data: Parameters<typeof apiPost>[1]) {
    await apiPost('/api/v1/admin/content/posts', data)
    router.push('/content/posts')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Post"
        description="Create a new blog post."
      />
      <div className="bg-surface border border-border rounded-xl p-6">
        <PostForm onSubmit={handleSubmit} />
      </div>
    </div>
  )
}
