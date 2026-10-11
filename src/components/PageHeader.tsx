import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface PageHeaderProps {
  title: string
  /** Where the back arrow goes. Leave out on top-level tabs. */
  backTo?: string
  action?: ReactNode
}

export function PageHeader({ title, backTo, action }: PageHeaderProps) {
  return (
    <header className="mb-4 flex min-h-12 items-center gap-2">
      {backTo && (
        <Link
          to={backTo}
          aria-label="Back"
          className="-ml-2 flex size-11 items-center justify-center rounded-full active:bg-surface-2"
        >
          <ChevronLeft className="size-7" />
        </Link>
      )}
      <h1 className="flex-1 truncate font-display text-3xl font-bold uppercase tracking-wide">{title}</h1>
      {action}
    </header>
  )
}
