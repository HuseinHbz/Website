'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const KIND_OPTIONS = [
  { value: '', label: 'All Kinds' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'INTRO_CALL', label: 'Intro Call' },
]

export function ConsultationsFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams]
  )

  return (
    <div className={`flex flex-wrap gap-3 ${isPending ? 'opacity-60' : ''}`}>
      <select
        defaultValue={searchParams.get('status') || ''}
        onChange={(e) => updateParam('status', e.target.value)}
        className="form-input w-auto text-sm py-1.5 cursor-pointer"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        defaultValue={searchParams.get('kind') || ''}
        onChange={(e) => updateParam('kind', e.target.value)}
        className="form-input w-auto text-sm py-1.5 cursor-pointer"
      >
        {KIND_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
