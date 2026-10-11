import { ChevronRight, LogOut, Pencil, Users } from 'lucide-react'
import { useCallback, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { PageHeader } from '../components/PageHeader'
import { Button, Card } from '../components/ui'
import { useAuth } from '../lib/auth'
import { fetchMyGroups } from '../lib/groups'
import { useAsync } from '../lib/useAsync'

function formatHeight(inches: number) {
  return `${Math.floor(inches / 12)}'${inches % 12}"`
}

export function Profile() {
  const { profile, signOut } = useAuth()
  const me = profile!
  const groups = useAsync(useCallback(() => fetchMyGroups(me.id), [me.id]))

  const details = [
    [me.primary_position, me.secondary_position].filter(Boolean).join(' / '),
    me.height_in ? formatHeight(me.height_in) : null,
    me.weight_lb ? `${me.weight_lb} lb` : null,
  ].filter(Boolean)

  return (
    <>
      <PageHeader title="Profile" />

      <Card className="flex flex-col items-center text-center">
        <Avatar profile={me} size="lg" />
        <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide">{me.display_name}</h2>
        {me.nickname && <p className="text-accent">“{me.nickname}”</p>}
        <p className="text-sm text-muted">@{me.username}</p>
        {details.length > 0 && <p className="mt-2 text-sm text-muted">{details.join(' · ')}</p>}
        {groups.data && groups.data.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {groups.data.map((group) => (
              <span key={group.id} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold">
                {group.name}
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
        <MenuLink to="/profile/edit" icon={<Pencil className="size-5" />} label="Edit profile" />
        <MenuLink
          to="/groups"
          icon={<Users className="size-5" />}
          label="My groups"
          detail={groups.data ? String(groups.data.length) : undefined}
        />
      </div>

      <Button variant="ghost" full className="mt-4 text-muted" onClick={signOut}>
        <LogOut className="size-5" /> Sign out
      </Button>
    </>
  )
}

function MenuLink({ to, icon, label, detail }: { to: string; icon: ReactNode; label: string; detail?: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center gap-3 border-b border-line px-4 last:border-b-0 active:bg-surface-2"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1 font-semibold">{label}</span>
      {detail && <span className="text-muted">{detail}</span>}
      <ChevronRight className="size-5 text-muted" />
    </Link>
  )
}
