import { ChartColumn, House, User } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

const TABS = [
  { to: '/', label: 'Home', icon: House },
  { to: '/stats', label: 'Stats', icon: ChartColumn },
  { to: '/profile', label: 'Profile', icon: User },
]

/** Page frame with the bottom tab bar. Full-screen pages (like the live scorer) render outside it. */
export function AppLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <main className="px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        aria-label="Main"
      >
        <ul className="mx-auto flex max-w-lg">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wide
                  active:bg-surface ${isActive ? 'text-accent' : 'text-muted'}`
                }
              >
                <Icon className="size-6" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
