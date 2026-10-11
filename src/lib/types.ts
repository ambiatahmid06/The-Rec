// Shapes of the rows the app reads from Supabase (see supabase/migrations).

export type Role = 'owner' | 'manager' | 'member'

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C'

export interface Profile {
  id: string
  username: string
  display_name: string
  nickname: string | null
  avatar_url: string | null
  height_in: number | null
  weight_lb: number | null
  primary_position: Position | null
  secondary_position: Position | null
}

/** The few profile fields shown in lists and avatars. */
export type ProfileSummary = Pick<Profile, 'id' | 'username' | 'display_name' | 'nickname' | 'avatar_url'>

export interface Group {
  id: string
  name: string
  owner_id: string
  created_at: string
}

/** One of my groups, with my role in it. */
export interface MyGroup extends Group {
  my_role: Role
  member_count: number
}

export interface GroupMember {
  user_id: string
  role: Role
  joined_at: string
  profile: ProfileSummary
}

/** An invite addressed to me (from my_pending_invites). */
export interface MyInvite {
  invite_id: string
  group_id: string
  group_name: string
  invited_by_name: string | null
  created_at: string
}

/** A pending invite as seen by a group's owner/managers (from group_pending_invites). */
export interface GroupInvite {
  invite_id: string
  invited_label: string
  invited_by_name: string | null
  created_at: string
}
