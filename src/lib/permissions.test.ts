import { describe, expect, it } from 'vitest'
import {
  canChangeRoles,
  canInvite,
  canKick,
  canLeaveGroup,
  canRenameOrDeleteGroup,
  canRevokeInvite,
  canTransferOwnership,
} from './permissions'

describe('permission table (spec section 4)', () => {
  it('lets owners and managers invite and revoke, but not members', () => {
    expect([canInvite('owner'), canInvite('manager'), canInvite('member'), canInvite(null)]).toEqual([
      true,
      true,
      false,
      false,
    ])
    expect([canRevokeInvite('owner'), canRevokeInvite('manager'), canRevokeInvite('member')]).toEqual([
      true,
      true,
      false,
    ])
  })

  it('lets owners kick managers and members, managers kick members only', () => {
    expect(canKick('owner', 'manager')).toBe(true)
    expect(canKick('owner', 'member')).toBe(true)
    expect(canKick('owner', 'owner')).toBe(false)
    expect(canKick('manager', 'member')).toBe(true)
    expect(canKick('manager', 'manager')).toBe(false)
    expect(canKick('manager', 'owner')).toBe(false)
    expect(canKick('member', 'member')).toBe(false)
    expect(canKick(null, 'member')).toBe(false)
  })

  it('keeps role changes, transfers, renames and deletes owner-only', () => {
    for (const check of [canChangeRoles, canTransferOwnership, canRenameOrDeleteGroup]) {
      expect([check('owner'), check('manager'), check('member')]).toEqual([true, false, false])
    }
  })

  it('makes the owner transfer before leaving', () => {
    expect([canLeaveGroup('owner'), canLeaveGroup('manager'), canLeaveGroup('member')]).toEqual([
      false,
      true,
      true,
    ])
  })
})
