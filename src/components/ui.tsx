// Small building blocks used across screens.
import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { ROLE_LABELS } from '../lib/permissions'
import type { Role } from '../lib/types'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-black',
  secondary: 'bg-surface-2 text-ink border border-line',
  ghost: 'bg-transparent text-ink',
  danger: 'bg-danger/15 text-danger border border-danger/30',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  busy?: boolean
  full?: boolean
}

export function Button({ variant = 'primary', busy, full, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition
        active:scale-[0.98] active:brightness-90 disabled:opacity-50 disabled:active:scale-100
        ${BUTTON_STYLES[variant]} ${full ? 'w-full' : ''} ${className}`}
      disabled={disabled || busy}
      {...rest}
    >
      {busy && <LoaderCircle className="size-5 animate-spin" />}
      {children}
    </button>
  )
}

/** A link that looks like a Button. */
export function ButtonLink({
  to,
  variant = 'primary',
  className = '',
  children,
}: {
  to: string
  variant?: ButtonVariant
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 font-semibold transition
        active:scale-[0.98] active:brightness-90 ${BUTTON_STYLES[variant]} ${className}`}
    >
      {children}
    </Link>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>{children}</div>
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string | null
}

export function TextField({ label, hint, error, id, ...rest }: TextFieldProps) {
  const inputId = id ?? rest.name
  return (
    <label className="block" htmlFor={inputId}>
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <input
        id={inputId}
        className={`h-12 w-full rounded-xl border bg-surface-2 px-4 text-base text-ink outline-none placeholder:text-muted/60
          focus:border-accent ${error ? 'border-danger' : 'border-line'}`}
        {...rest}
      />
      {error ? (
        <span className="mt-1.5 block text-sm text-danger">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-sm text-muted">{hint}</span>
      )}
    </label>
  )
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      {children}
    </p>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return <LoaderCircle className={`size-6 animate-spin text-muted ${className}`} aria-label="Loading" />
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-8" />
    </div>
  )
}

const ROLE_BADGE_STYLES: Record<Role, string> = {
  owner: 'bg-accent/15 text-accent',
  manager: 'bg-team-b/15 text-team-b',
  member: 'bg-surface-2 text-muted',
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${ROLE_BADGE_STYLES[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}

/** Section heading inside a page. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  )
}
