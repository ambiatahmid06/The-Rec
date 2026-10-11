// The permission table from section 4 of the spec, used to decide which
// buttons to show. The database functions enforce the same rules for real.
import type { Role } from './types'

const isStaff = (role: Role | null) => role === 'owner' || role === 'manager'

export const canInvite = (myRole: Role | null) => isStaff(myRole)

export const canRevokeInvite = (myRole: Role | null) => isStaff(myRole)

/** Owners can remove managers and members; managers can remove members only. */
export function canKick(myRole: Role | null, targetRole: Role) {
  if (myRole === 'owner') return targetRole !== 'owner'
  if (myRole === 'manager') return targetRole === 'member'
  return false
}

export const canChangeRoles = (myRole: Role | null) => myRole === 'owner'

export const canTransferOwnership = (myRole: Role | null) => myRole === 'owner'

export const canRenameOrDeleteGroup = (myRole: Role | null) => myRole === 'owner'

export const canManageLocations = (myRole: Role | null) => isStaff(myRole)

export const canEditFinishedGames = (myRole: Role | null) => isStaff(myRole)

/** The owner has to transfer ownership before leaving. */
export const canLeaveGroup = (myRole: Role | null) => myRole === 'manager' || myRole === 'member'

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  member: 'Member',
}
