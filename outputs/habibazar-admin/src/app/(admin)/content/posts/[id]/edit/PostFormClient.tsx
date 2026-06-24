'use client'

import { useRouter } from 'next/navigation'
import { PostForm } from '@/components/content/PostForm'
import { apiPatch } from '@/lib/api'
import type { Post } from '@/lib/types'

interface PostFormClientProps {
  post: Post
}

export function PostFormClient({ post }: PostFormClientProps) {
  const router = useRouter()

  async function handleSubmit(data: Parameters<typeof apiPatch>[1]) {
    await apiPatch(`/api/v1/admin/content/posts/${post.id}`, data)
    router.push('/content/posts')
    router.refresh()
  }

  return <PostForm post={post} onSubmit={handleSubmit} />
}
