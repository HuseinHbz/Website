import { cn } from '@/lib/utils'

type StatusType = 'available' | 'online' | 'busy' | 'offline'

export interface StatusNodeProps {
  label: string
  status?: StatusType
  className?: string
}

const statusColors: Record<StatusType, string> = {
  available: 'bg-success',
  online: 'bg-success',
  busy: 'bg-warning',
  offline: 'bg-text-muted',
}

export function StatusNode({
  label,
  status = 'available',
  className,
}: StatusNodeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-success/10 border border-success/20',
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            statusColors[status]
          )}
        />
        <span
          className={cn(
            'relative inline-flex rounded-full h-2 w-2',
            statusColors[status]
          )}
        />
      </span>
      <span className="text-xs font-medium text-success">{label}</span>
    </div>
  )
}
