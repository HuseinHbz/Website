import { formatDateTime } from '@/lib/utils'
import type { LeadEvent } from '@/lib/types'

interface LeadEventTimelineProps {
  events: LeadEvent[]
}

export function LeadEventTimeline({ events }: LeadEventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-text-muted">
        No events recorded for this lead.
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-4">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-accent mt-1 flex-shrink-0" />
            {i < events.length - 1 && (
              <div className="w-px flex-1 bg-border mt-1" />
            )}
          </div>

          {/* Content */}
          <div className="pb-6 flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-text-primary capitalize">
                {event.type.replace(/_/g, ' ').toLowerCase()}
              </p>
              <span className="text-xs text-text-muted flex-shrink-0">
                {formatDateTime(event.createdAt)}
              </span>
            </div>
            {event.data && Object.keys(event.data).length > 0 && (
              <pre className="mt-1 text-xs text-text-muted bg-surface2 rounded p-2 overflow-x-auto">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
