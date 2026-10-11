import type { ProfileSummary } from '../lib/types'

const SIZES = {
  sm: 'size-10 text-sm',
  md: 'size-14 text-lg',
  lg: 'size-24 text-3xl',
}

interface AvatarProps {
  profile: Pick<ProfileSummary, 'display_name' | 'avatar_url'>
  size?: keyof typeof SIZES
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function Avatar({ profile, size = 'sm' }: AvatarProps) {
  const classes = `${SIZES[size]} shrink-0 rounded-full`
  if (profile.avatar_url) {
    return <img src={profile.avatar_url} alt="" className={`${classes} bg-surface-2 object-cover`} />
  }
  return (
    <div
      className={`${classes} flex items-center justify-center bg-surface-2 font-display font-bold text-muted`}
      aria-hidden
    >
      {initials(profile.display_name)}
    </div>
  )
}
