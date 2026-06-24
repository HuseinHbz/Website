'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ContentStatusBadge } from '@/components/ui/Badge'
import { ConfirmModal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'

interface ContentItem {
  id: string
  slug: string
  title: string
  status: string
  updatedAt: string
}

interface ContentTableProps {
  items: ContentItem[]
  onDelete: (id: string) => void
  editHref: (id: string) => string
}

export function ContentTable({ items, onDelete, editHref }: ContentTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await onDelete(deleteTarget)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <EmptyState
          title="No content yet"
          description="Create your first piece of content to get started."
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        />
      </div>
    )
  }

  return (
    <>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <p className="font-medium text-text-primary">{item.title}</p>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-text-muted">{item.slug}</span>
                  </td>
                  <td>
                    <ContentStatusBadge status={item.status} />
                  </td>
                  <td className="text-xs">{formatDate(item.updatedAt)}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Link
                        href={editHref(item.id)}
                        className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(item.id)}
                        className="text-xs font-medium text-danger/70 hover:text-danger transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Content"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        variant="danger"
      />
    </>
  )
}
