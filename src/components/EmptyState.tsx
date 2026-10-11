import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  message?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <Icon className="mb-3 size-10 text-muted" strokeWidth={1.5} />
      <p className="font-display text-xl font-bold uppercase tracking-wide">{title}</p>
      {message && <p className="mt-1 max-w-xs text-sm text-muted">{message}</p>}
      {action && <div className="mt-5 w-full max-w-xs">{action}</div>}
    </div>
  )
}
