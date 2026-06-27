'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmModal } from '@/components/ui/Modal'
import { apiDelete } from '@/lib/api'

interface ConfirmDeleteServiceProps {
  serviceId: string
}

export function ConfirmDeleteService({ serviceId }: ConfirmDeleteServiceProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      await apiDelete(`/api/v1/admin/services/${serviceId}`)
      setOpen(false)
      router.refresh()
    } catch {
      // Could show toast; for now silently fail and close
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-danger/70 hover:text-danger transition-colors"
      >
        Delete
      </button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleDelete}
        title="Delete Service"
        message="Are you sure you want to delete this service? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={loading}
      />
    </>
  )
}
