// Phase 1 acceptance checks, run against the real migration SQL.
// The steps build on each other, so they run in order on one database.
import { beforeAll, describe, expect, it } from 'vitest'
import { addUser, as, createTestDb } from './testDb'

let db: Awaited<ReturnType<typeof createTestDb>>
let aliceId: string, bobId: string, caraId: string, danId: string
let alice: ReturnType<typeof as>, bob: ReturnType<typeof as>
let cara: ReturnType<typeof as>, dan: ReturnType<typeof as>
let groupId: string

async function pendingInvites(user: ReturnType<typeof as>) {
  return user.query<{ invite_id: string; group_name: string; invited_by_name: string }>(
    'select * from public.my_pending_invites()',
  )
}

async function roles() {
  const rows = await alice.query<{ user_id: string; role: string }>(
    'select user_id, role from public.group_members where group_id = $1',
    [groupId],
  )
  return Object.fromEntries(rows.map((r) => [r.user_id, r.role]))
}

beforeAll(async () => {
  db = await createTestDb()
  aliceId = await addUser(db, 'alice')
  bobId = await addUser(db, 'bob')
  caraId = await addUser(db, 'cara', { email: 'Cara@Example.com' })
  danId = await addUser(db, 'dan') // never joins: the outsider
  alice = as(db, aliceId)
  bob = as(db, bobId)
  cara = as(db, caraId)
  dan = as(db, danId)
})

describe('Phase 1: groups, invites and roles', () => {
  it('lets a user create a group and become its owner', async () => {
    const [row] = await alice.query<{ id: string }>("select public.create_group('Sunday Run') as id")
    groupId = row.id
    expect(await roles()).toEqual({ [aliceId]: 'owner' })
  })

  it('invites by username and shows the invite only to that player', async () => {
    await alice.query("select public.invite_by_username($1, 'BOB')", [groupId])

    const bobsInvites = await pendingInvites(bob)
    expect(bobsInvites).toHaveLength(1)
    expect(bobsInvites[0]).toMatchObject({ group_name: 'Sunday Run', invited_by_name: 'ALICE' })
    expect(await pendingInvites(dan)).toHaveLength(0)
  })

  it('does not add anyone until they accept', async () => {
    expect(await roles()).not.toHaveProperty(bobId)
    const [invite] = await pendingInvites(bob)
    await bob.query('select public.respond_to_invite($1, true)', [invite.invite_id])
    expect((await roles())[bobId]).toBe('member')
    expect(await pendingInvites(bob)).toHaveLength(0)
  })

  it('invites by email, matching case-insensitively', async () => {
    await alice.query("select public.invite_by_email($1, 'cara@example.com')", [groupId])
    const [invite] = await pendingInvites(cara)
    expect(invite.group_name).toBe('Sunday Run')
    await cara.query('select public.respond_to_invite($1, true)', [invite.invite_id])
    expect((await roles())[caraId]).toBe('member')
  })

  it('does not match email invites for an unconfirmed email', async () => {
    const eveId = await addUser(db, 'eve', { confirmed: false })
    await alice.query("select public.invite_by_email($1, 'eve@example.com')", [groupId])
    expect(await pendingInvites(as(db, eveId))).toHaveLength(0)
  })

  it('declining an invite does not add the player', async () => {
    const finnId = await addUser(db, 'finn')
    await alice.query("select public.invite_by_username($1, 'finn')", [groupId])
    const [invite] = await pendingInvites(as(db, finnId))
    await as(db, finnId).query('select public.respond_to_invite($1, false)', [invite.invite_id])
    expect(await roles()).not.toHaveProperty(finnId)
  })

  it('stops players accepting invites meant for someone else', async () => {
    const [invite] = await alice.query<{ id: string }>(
      "select public.invite_by_username($1, 'dan') as id",
      [groupId],
    )
    await expect(cara.query('select public.respond_to_invite($1, true)', [invite.id])).rejects.toThrow(
      'Invite not found',
    )
    await alice.query('select public.revoke_invite($1)', [invite.id])
    expect(await pendingInvites(dan)).toHaveLength(0)
  })

  it('only lets the owner promote a manager', async () => {
    await expect(
      bob.query("select public.set_member_role($1, $2, 'manager')", [groupId, caraId]),
    ).rejects.toThrow('Only the owner')
    await alice.query("select public.set_member_role($1, $2, 'manager')", [groupId, bobId])
    expect((await roles())[bobId]).toBe('manager')
  })

  it('does not let members invite, and lets managers invite', async () => {
    await expect(cara.query("select public.invite_by_username($1, 'dan')", [groupId])).rejects.toThrow(
      'Only the owner or a manager',
    )
    await bob.query("select public.invite_by_username($1, 'dan')", [groupId])
    await alice.query("select public.invite_by_email($1, 'someone@new.com')", [groupId])
    const labels = await bob.query<{ invited_label: string }>(
      'select invited_label from public.group_pending_invites($1) order by 1',
      [groupId],
    )
    expect(labels.map((l) => l.invited_label)).toEqual(['@dan', 'eve@example.com', 'someone@new.com'])
    expect(await cara.query('select * from public.group_pending_invites($1)', [groupId])).toHaveLength(0)
    const [invite] = await pendingInvites(dan)
    await bob.query('select public.revoke_invite($1)', [invite.invite_id])
  })

  it('does not let a manager kick the owner or another manager', async () => {
    await expect(bob.query('select public.kick_member($1, $2)', [groupId, aliceId])).rejects.toThrow(
      'permission',
    )
    await alice.query("select public.set_member_role($1, $2, 'manager')", [groupId, caraId])
    await expect(bob.query('select public.kick_member($1, $2)', [groupId, caraId])).rejects.toThrow(
      'permission',
    )
    await alice.query("select public.set_member_role($1, $2, 'member')", [groupId, caraId])
  })

  it('does not let a member kick anyone', async () => {
    await expect(cara.query('select public.kick_member($1, $2)', [groupId, bobId])).rejects.toThrow(
      'permission',
    )
  })

  it('lets a manager kick a member, who then loses access to the group', async () => {
    await bob.query('select public.kick_member($1, $2)', [groupId, caraId])
    expect(await roles()).not.toHaveProperty(caraId)
    expect(await cara.query('select * from public.groups')).toHaveLength(0)
    expect(await cara.query('select * from public.group_members')).toHaveLength(0)
    expect(await cara.query('select * from public.profiles where id = $1', [aliceId])).toHaveLength(0)
  })

  it('does not let the owner leave, but lets them transfer ownership', async () => {
    await expect(alice.query('select public.leave_group($1)', [groupId])).rejects.toThrow(
      'Transfer ownership',
    )
    await alice.query('select public.transfer_ownership($1, $2)', [groupId, bobId])
    expect(await roles()).toEqual({ [aliceId]: 'manager', [bobId]: 'owner' })
    const [group] = await bob.query<{ owner_id: string }>('select owner_id from public.groups')
    expect(group.owner_id).toBe(bobId)
    await expect(
      alice.query('select public.transfer_ownership($1, $2)', [groupId, aliceId]),
    ).rejects.toThrow('Only the owner')
  })

  it('lets a former owner leave once they are a manager', async () => {
    await alice.query('select public.leave_group($1)', [groupId])
    const rows = await bob.query('select user_id from public.group_members where group_id = $1', [groupId])
    expect(rows).toEqual([{ user_id: bobId }])
  })
})

describe('Phase 1: outsiders and direct writes', () => {
  it('hides every part of a group from a user outside it', async () => {
    expect(await dan.query('select * from public.groups')).toHaveLength(0)
    expect(await dan.query('select * from public.group_members')).toHaveLength(0)
    expect(await dan.query('select * from public.group_invites where group_id = $1', [groupId])).toHaveLength(0)
    expect(await dan.query('select * from public.profiles where id = $1', [bobId])).toHaveLength(0)
  })

  it('does not let outsiders use the group functions', async () => {
    await expect(dan.query("select public.invite_by_username($1, 'dan')", [groupId])).rejects.toThrow()
    await expect(dan.query('select public.kick_member($1, $2)', [groupId, bobId])).rejects.toThrow()
    await expect(dan.query("select public.rename_group($1, 'Mine now')", [groupId])).rejects.toThrow()
    await expect(dan.query('select public.delete_group($1)', [groupId])).rejects.toThrow()
  })

  it('blocks writing membership tables directly, bypassing the functions', async () => {
    await expect(
      dan.query("insert into public.group_members (group_id, user_id, role) values ($1, $2, 'owner')", [
        groupId,
        danId,
      ]),
    ).rejects.toThrow()
    // Even the owner can't change these tables directly, only through the functions.
    await expect(
      bob.query("update public.group_members set role = 'member' where group_id = $1", [groupId]),
    ).rejects.toThrow('permission denied')
    await expect(bob.query('delete from public.groups where id = $1', [groupId])).rejects.toThrow(
      'permission denied',
    )
    await expect(bob.query('truncate public.group_invites')).rejects.toThrow('permission denied')
    const rows = await bob.query('select role from public.group_members where group_id = $1', [groupId])
    expect(rows).toEqual([{ role: 'owner' }])
  })

  it('does not let signed-out visitors read anything or call functions', async () => {
    const anon = as(db, null)
    await expect(anon.query('select * from public.profiles')).rejects.toThrow('permission denied')
    await expect(anon.query('select * from public.groups')).rejects.toThrow('permission denied')
    await expect(anon.query("select public.create_group('x')")).rejects.toThrow()
  })

  it('lets users write only their own profile', async () => {
    await expect(
      dan.query("update public.profiles set display_name = 'Hacked' where id = $1 returning id", [bobId]),
    ).resolves.toHaveLength(0)
    await expect(
      dan.query("insert into public.profiles (id, username, display_name) values ($1, 'imposter', 'X')", [
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow()
    await dan.query("update public.profiles set nickname = 'D' where id = $1", [danId])
  })

  it('rejects usernames that are not lowercase letters, numbers or underscores', async () => {
    const ghostId = await addUser(db, 'ghost', { withProfile: false })
    await expect(
      as(db, ghostId).query("insert into public.profiles (id, username, display_name) values ($1, 'Bad Name', 'G')", [
        ghostId,
      ]),
    ).rejects.toThrow()
  })

  it('only lets the owner rename or delete the group', async () => {
    await bob.query("select public.rename_group($1, 'Tuesday Run')", [groupId])
    await bob.query('select public.delete_group($1)', [groupId])
    expect(await bob.query('select * from public.groups')).toHaveLength(0)
  })
})
