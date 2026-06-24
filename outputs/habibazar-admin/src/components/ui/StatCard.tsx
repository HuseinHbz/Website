import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  change?: string
  icon?: React.ReactNode
  color?: 'default' | 'success' | 'warning' | 'danger'
}

const colorMap = {
  default: 'text-accent bg-accent/10 border-accent/20',
  success: 'text-success bg-success/10 border-success/20',
  warning: 'text-warning bg-warning/10 border-warning/20',
  danger: 'text-danger bg-danger/10 border-danger/20',
}

export function StatCard({ label, value, change, icon, color = 'default' }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6 hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-muted font-medium truncate">{label}</p>
          <p className="text-3xl font-bold text-text-primary mt-2">{value}</p>
          {change && (
            <p className="text-xs text-text-muted mt-1">{change}</p>
          )}
        </div>
        {icon && (
          <div className={cn('p-3 rounded-xl border', colorMap[color])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
