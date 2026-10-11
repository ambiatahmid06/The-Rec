// Everything the app does with groups, members and invites.
// Reads go through RLS; every change goes through a database function
// (supabase.rpc) that checks permissions on the server.
import { friendlyError } from './errors'
import { supabase } from './supabase'
import type { Group, GroupInvite, GroupMember, MyGroup, MyInvite, Role } from './types'

async function rpc<T = void>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(friendlyError(error))
  return data as T
}

const ROLE_ORDER: Record<Role, number> = { owner: 0, manager: 1, member: 2 }

export async function fetchMyGroups(userId: string): Promise<MyGroup[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('role, group:groups(id, name, owner_id, created_at)')
    .eq('user_id', userId)
  if (error) throw new Error(friendlyError(error))

  const rows = (data ?? []) as unknown as { role: Role; group: Group }[]
  if (rows.length === 0) return []

  // Count members per group (we can read members of every group we're in).
  const { data: memberRows, error: countError } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', rows.map((r) => r.group.id))
  if (countError) throw new Error(friendlyError(countError))

  const counts = new Map<string, number>()
  for (const { group_id } of memberRows ?? []) counts.set(group_id, (counts.get(group_id) ?? 0) + 1)

  return rows
    .map((r) => ({ ...r.group, my_role: r.role, member_count: counts.get(r.group.id) ?? 1 }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function fetchGroup(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle()
  if (error) throw new Error(friendlyError(error))
  return data
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, role, joined_at, profile:profiles(id, username, display_name, nickname, avatar_url)')
    .eq('group_id', groupId)
  if (error) throw new Error(friendlyError(error))

  return ((data ?? []) as unknown as GroupMember[]).sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      a.profile.display_name.localeCompare(b.profile.display_name),
  )
}

export const fetchGroupInvites = (groupId: string) =>
  rpc<GroupInvite[]>('group_pending_invites', { p_group_id: groupId })

export const fetchMyInvites = () => rpc<MyInvite[]>('my_pending_invites')

export const createGroup = (name: string) => rpc<string>('create_group', { p_name: name })

export const renameGroup = (groupId: string, name: string) =>
  rpc('rename_group', { p_group_id: groupId, p_name: name })

export const deleteGroup = (groupId: string) => rpc('delete_group', { p_group_id: groupId })

export const inviteByUsername = (groupId: string, username: string) =>
  rpc<string>('invite_by_username', { p_group_id: groupId, p_username: username })

export const inviteByEmail = (groupId: string, email: string) =>
  rpc<string>('invite_by_email', { p_group_id: groupId, p_email: email })

export const revokeInvite = (inviteId: string) => rpc('revoke_invite', { p_invite_id: inviteId })

export const respondToInvite = (inviteId: string, accept: boolean) =>
  rpc('respond_to_invite', { p_invite_id: inviteId, p_accept: accept })

export const kickMember = (groupId: string, userId: string) =>
  rpc('kick_member', { p_group_id: groupId, p_user_id: userId })

export const setMemberRole = (groupId: string, userId: string, role: 'manager' | 'member') =>
  rpc('set_member_role', { p_group_id: groupId, p_user_id: userId, p_role: role })

export const transferOwnership = (groupId: string, newOwnerId: string) =>
  rpc('transfer_ownership', { p_group_id: groupId, p_new_owner_id: newOwnerId })

export const leaveGroup = (groupId: string) => rpc('leave_group', { p_group_id: groupId })
