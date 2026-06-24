'use client'

import { useState } from 'react'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { Service } from '@/lib/types'

interface ServiceFormData {
  titleFa: string
  titleEn: string
  descriptionFa: string
  descriptionEn: string
  icon: string
  status: string
  sortOrder: number
}

interface ServiceFormProps {
  service?: Service
  onSubmit: (data: ServiceFormData) => Promise<void>
}

export function ServiceForm({ service, onSubmit }: ServiceFormProps) {
  const [formData, setFormData] = useState<ServiceFormData>({
    titleFa: service?.titleFa || '',
    titleEn: service?.titleEn || '',
    descriptionFa: service?.descriptionFa || '',
    descriptionEn: service?.descriptionEn || '',
    icon: service?.icon || '',
    status: service?.status || 'DRAFT',
    sortOrder: service?.sortOrder || 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }))
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Description (Persian)</label>
          <textarea
            name="descriptionFa"
            value={formData.descriptionFa}
            onChange={handleChange}
            dir="rtl"
            rows={4}
            className="form-input resize-none"
            placeholder="توضیحات فارسی"
          />
        </div>
        <div>
          <label className="form-label">Description (English)</label>
          <textarea
            name="descriptionEn"
            value={formData.descriptionEn}
            onChange={handleChange}
            rows={4}
            className="form-input resize-none"
            placeholder="English description"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="form-label">Icon</label>
          <input
            name="icon"
            value={formData.icon}
            onChange={handleChange}
            className="form-input"
            placeholder="e.g. star, briefcase"
          />
          <p className="text-xs text-text-muted mt-1">Icon identifier string</p>
        </div>
        <div>
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
        <div>
          <label className="form-label">Sort Order</label>
          <input
            name="sortOrder"
            type="number"
            value={formData.sortOrder}
            onChange={handleChange}
            min={0}
            className="form-input"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading}>
          {service ? 'Update Service' : 'Create Service'}
        </Button>
      </div>
    </form>
  )
}
