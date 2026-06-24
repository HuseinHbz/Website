import { cn } from '@/lib/utils'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'default' | 'info'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  default: 'bg-surface2 text-text-secondary border-border',
  info: 'bg-accent/10 text-accent border-accent/20',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

// Status-specific badge helpers
export function LeadStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    NEW: 'info',
    CONTACTED: 'warning',
    QUALIFIED: 'success',
    CONVERTED: 'success',
    LOST: 'danger',
  }
  return <Badge variant={map[status] || 'default'}>{status}</Badge>
}

export function ConsultationStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    PENDING: 'warning',
    SCHEDULED: 'info',
    COMPLETED: 'success',
    CANCELLED: 'danger',
  }
  return <Badge variant={map[status] || 'default'}>{status}</Badge>
}

export function ContentStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    DRAFT: 'default',
    PUBLISHED: 'success',
    ARCHIVED: 'warning',
  }
  return <Badge variant={map[status] || 'default'}>{status}</Badge>
}

export function EngagementStageBadge({ stage }: { stage: string }) {
  const map: Record<string, BadgeVariant> = {
    PROSPECT: 'info',
    PROPOSAL: 'warning',
    NEGOTIATION: 'warning',
    CLOSED_WON: 'success',
    CLOSED_LOST: 'danger',
  }
  return <Badge variant={map[stage] || 'default'}>{stage.replace('_', ' ')}</Badge>
}

export function UserStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    ACTIVE: 'success',
    INACTIVE: 'default',
    SUSPENDED: 'danger',
  }
  return <Badge variant={map[status] || 'default'}>{status}</Badge>
}
