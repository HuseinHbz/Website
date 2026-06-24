'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { Post } from '@/lib/types'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface PostFormData {
  titleFa: string
  titleEn: string
  slug: string
  summaryFa: string
  summaryEn: string
  bodyFa: string
  bodyEn: string
  status: string
}

interface PostFormProps {
  post?: Post
  onSubmit: (data: PostFormData) => Promise<void>
}

export function PostForm({ post, onSubmit }: PostFormProps) {
  const [formData, setFormData] = useState<PostFormData>({
    titleFa: post?.titleFa || '',
    titleEn: post?.titleEn || '',
    slug: post?.slug || '',
    summaryFa: post?.summaryFa || '',
    summaryEn: post?.summaryEn || '',
    bodyFa: post?.bodyFa || '',
    bodyEn: post?.bodyEn || '',
    status: post?.status || 'DRAFT',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setFormData((prev) => {
      const updated = { ...prev, [name]: value }
      // Auto-generate slug from English title
      if (name === 'titleEn' && !post) {
        updated.slug = slugify(value)
      }
      return updated
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await onSubmit(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Title (Persian)</label>
          <input
            name="titleFa"
            value={formData.titleFa}
            onChange={handleChange}
            required
            dir="rtl"
            className="form-input"
            placeholder="عنوان فارسی"
          />
        </div>
        <div>
          <label className="form-label">Title (English)</label>
          <input
            name="titleEn"
            value={formData.titleEn}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="English Title"
          />
        </div>
      </div>

      <div>
        <label className="form-label">Slug</label>
        <input
          name="slug"
          value={formData.slug}
          onChange={handleChange}
          required
          className="form-input font-mono text-sm"
          placeholder="url-friendly-slug"
        />
        <p className="text-xs text-text-muted mt-1">Auto-generated from English title. Edit manually if needed.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Summary (Persian)</label>
          <textarea
            name="summaryFa"
            value={formData.summaryFa}
            onChange={handleChange}
            dir="rtl"
            rows={3}
            className="form-input resize-none"
            placeholder="خلاصه فارسی"
          />
        </div>
        <div>
          <label className="form-label">Summary (English)</label>
          <textarea
            name="summaryEn"
            value={formData.summaryEn}
            onChange={handleChange}
            rows={3}
            className="form-input resize-none"
            placeholder="English summary"
          />
        </div>
      </div>

      <div>
        <label className="form-label">Body (Persian)</label>
        <textarea
          name="bodyFa"
          value={formData.bodyFa}
          onChange={handleChange}
          dir="rtl"
          rows={12}
          className="form-input resize-y"
          placeholder="محتوای فارسی..."
        />
      </div>

      <div>
        <label className="form-label">Body (English)</label>
        <textarea
          name="bodyEn"
          value={formData.bodyEn}
          onChange={handleChange}
          rows={12}
          className="form-input resize-y"
          placeholder="English content..."
        />
      </div>

      <div className="max-w-xs">
        <Select
          label="Status"
          name="status"
          value={formData.status}
          onChange={handleChange}
          options={[
            { value: 'DRAFT', label: 'Draft' },
            { value: 'PUBLISHED', label: 'Published' },
            { value: 'ARCHIVED', label: 'Archived' },
          ]}
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading}>
          {post ? 'Update Post' : 'Create Post'}
        </Button>
      </div>
    </form>
  )
}
