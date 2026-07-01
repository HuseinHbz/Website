import { cn } from '@/lib/utils'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type AvatarStatus = 'online' | 'offline' | 'away' | 'busy'

export interface AvatarProps {
  src?: string | null
  name?: string
  size?: AvatarSize
  status?: AvatarStatus
  className?: string
}

const sizes: Record<AvatarSize, string> = {
  xs:  'w-6 h-6 text-[10px]',
  sm:  'w-8 h-8 text-xs',
  md:  'w-10 h-10 text-sm',
  lg:  'w-12 h-12 text-base',
  xl:  'w-16 h-16 text-lg',
  '2xl': 'w-20 h-20 text-xl',
}

const statusSizes: Record<AvatarSize, string> = {
  xs:  'w-1.5 h-1.5',
  sm:  'w-2 h-2',
  md:  'w-2.5 h-2.5',
  lg:  'w-3 h-3',
  xl:  'w-3.5 h-3.5',
  '2xl': 'w-4 h-4',
}

const statusColors: Record<AvatarStatus, string> = {
  online:  'bg-success',
  offline: 'bg-text-disabled',
  away:    'bg-warning',
  busy:    'bg-danger',
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function stringToColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  const colors = [
    'bg-brand-muted text-brand-hover',
    'bg-success-muted text-success-text',
    'bg-warning-muted text-warning-text',
    'bg-info-muted text-info-text',
    'bg-danger-muted text-danger-text',
  ]
  return colors[Math.abs(hash) % colors.length]
}

export function Avatar({ src, name, size = 'md', status, className }: AvatarProps) {
  const initials = name ? getInitials(name) : '?'
  const colorClass = name ? stringToColor(name) : 'bg-surface-2 text-text-tertiary'

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full overflow-hidden font-semibold select-none',
          sizes[size],
          !src && colorClass,
        )}
        aria-label={name}
      >
        {src ? (
          <img src={src} alt={name ?? ''} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </span>
      {status && (
        <span
          aria-label={status}
          className={cn(
            'absolute bottom-0 end-0 rounded-full ring-2 ring-background',
            statusSizes[size],
            statusColors[status],
          )}
        />
      )}
    </span>
  )
}

// ── Avatar Group ──────────────────────────────────────────────────────────────

export interface AvatarGroupProps {
  avatars: Omit<AvatarProps, 'size'>[]
  size?: AvatarSize
  max?: number
  className?: string
}

export function AvatarGroup({ avatars, size = 'md', max = 5, className }: AvatarGroupProps) {
  const visible = avatars.slice(0, max)
  const overflow = avatars.length - max

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((a, i) => (
        <span key={i} className="-ms-2 first:ms-0 ring-2 ring-background rounded-full">
          <Avatar {...a} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            '-ms-2 ring-2 ring-background rounded-full inline-flex items-center justify-center font-semibold bg-surface-2 text-text-secondary',
            sizes[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
