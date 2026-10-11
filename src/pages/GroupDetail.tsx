import { Check, DoorOpen, Ellipsis, Pencil, SearchX, Trash2, UserPlus, X } from 'lucide-react'
import { useCallback, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import {
  Button,
  ButtonLink,
  Card,
  ErrorMessage,
  LoadingScreen,
  RoleBadge,
  SectionTitle,
  TextField,
} from '../components/ui'
import { useAuth } from '../lib/auth'
import {
  deleteGroup,
  fetchGroup,
  fetchGroupInvites,
  fetchGroupMembers,
  inviteByEmail,
  inviteByUsername,
  kickMember,
  leaveGroup,
  renameGroup,
  revokeInvite,
  setMemberRole,
  transferOwnership,
} from '../lib/groups'
import {
  canChangeRoles,
  canInvite,
  canKick,
  canLeaveGroup,
  canRenameOrDeleteGroup,
  canTransferOwnership,
} from '../lib/permissions'
import type { GroupMember, Role } from '../lib/types'
import { useAsync } from '../lib/useAsync'
import { looksLikeEmail, normalizeUsername } from '../lib/validation'

async function loadGroupPage(groupId: string) {
  const [group, members] = await Promise.all([fetchGroup(groupId), fetchGroupMembers(groupId)])
  return { group, members }
}

export function GroupDetail() {
  const { groupId } = useParams() as { groupId: string }
  const { profile } = useAuth()
  const myId = profile!.id
  const navigate = useNavigate()

  const page = useAsync(useCallback(() => loadGroupPage(groupId), [groupId]))
  const myRole: Role | null = page.data?.members.find((m) => m.user_id === myId)?.role ?? null
  const invites = useAsync(
    useCallback(async () => (canInvite(myRole) ? fetchGroupInvites(groupId) : []), [groupId, myRole]),
  )

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** Runs a change, shows any error, then reloads the page data. */
  async function run(key: string, action: () => Promise<unknown>, after?: () => void) {
    setBusy(key)
    setError(null)
    try {
      await action()
      setOpenMenu(null)
      if (after) after()
      else await Promise.all([page.reload(), invites.reload()])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (page.loading && !page.data) return <LoadingScreen />
  if (page.error) {
    return (
      <>
        <PageHeader title="Group" backTo="/groups" />
        <ErrorMessage>{page.error}</ErrorMessage>
      </>
    )
  }

  const { group, members } = page.data!
  if (!group || !myRole) {
    return (
      <>
        <PageHeader title="Group" backTo="/groups" />
        <EmptyState
          icon={SearchX}
          title="Group not found"
          message="It may have been deleted, or you're no longer a member."
          action={<ButtonLink to="/groups">Back to my groups</ButtonLink>}
        />
      </>
    )
  }

  return (
    <>
      <GroupTitle
        name={group.name}
        canRename={canRenameOrDeleteGroup(myRole)}
        onRename={(name) => run('rename', () => renameGroup(group.id, name))}
      />

      <ErrorMessage>{error}</ErrorMessage>

      {canInvite(myRole) && (
        <>
          <SectionTitle>Invite players</SectionTitle>
          <InviteForm groupId={group.id} onInvited={invites.reload} />
          {invites.data && invites.data.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
              {invites.data.map((invite) => (
                <div key={invite.invite_id} className="flex min-h-14 items-center gap-3 border-b border-line px-4 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{invite.invited_label}</p>
                    <p className="text-sm text-muted">Pending{invite.invited_by_name && ` · invited by ${invite.invited_by_name}`}</p>
                  </div>
                  <Button
                    variant="ghost"
                    className="text-muted"
                    aria-label={`Cancel invite for ${invite.invited_label}`}
                    busy={busy === invite.invite_id}
                    onClick={() => run(invite.invite_id, () => revokeInvite(invite.invite_id))}
                  >
                    <X className="size-5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <SectionTitle>
        {members.length} {members.length === 1 ? 'player' : 'players'}
      </SectionTitle>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {members.map((member) => {
          const actions = memberActions(myRole, myId, member)
          const isOpen = openMenu === member.user_id
          return (
            <div key={member.user_id} className="border-b border-line last:border-b-0">
              <div className="flex min-h-16 items-center gap-3 px-4 py-2">
                <Avatar profile={member.profile} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {member.profile.display_name}
                    {member.user_id === myId && <span className="font-normal text-muted"> (you)</span>}
                  </p>
                  <p className="truncate text-sm text-muted">@{member.profile.username}</p>
                </div>
                <RoleBadge role={member.role} />
                {actions.length > 0 && (
                  <button
                    className="-mr-2 flex size-11 items-center justify-center rounded-full text-muted active:bg-surface-2"
                    aria-label={`Options for ${member.profile.display_name}`}
                    aria-expanded={isOpen}
                    onClick={() => setOpenMenu(isOpen ? null : member.user_id)}
                  >
                    <Ellipsis className="size-5" />
                  </button>
                )}
              </div>
              {isOpen && (
                <div className="grid gap-2 px-4 pb-4">
                  {actions.includes('promote') && (
                    <Button
                      variant="secondary"
                      busy={busy === 'promote'}
                      onClick={() => run('promote', () => setMemberRole(group.id, member.user_id, 'manager'))}
                    >
                      Make manager
                    </Button>
                  )}
                  {actions.includes('demote') && (
                    <Button
                      variant="secondary"
                      busy={busy === 'demote'}
                      onClick={() => run('demote', () => setMemberRole(group.id, member.user_id, 'member'))}
                    >
                      Make regular member
                    </Button>
                  )}
                  {actions.includes('transfer') && (
                    <Button
                      variant="secondary"
                      busy={busy === 'transfer'}
                      onClick={() => {
                        if (
                          confirm(
                            `Make ${member.profile.display_name} the owner of ${group.name}? You'll become a manager.`,
                          )
                        ) {
                          run('transfer', () => transferOwnership(group.id, member.user_id))
                        }
                      }}
                    >
                      Make owner
                    </Button>
                  )}
                  {actions.includes('kick') && (
                    <Button
                      variant="danger"
                      busy={busy === 'kick'}
                      onClick={() => {
                        if (confirm(`Remove ${member.profile.display_name} from ${group.name}?`)) {
                          run('kick', () => kickMember(group.id, member.user_id))
                        }
                      }}
                    >
                      Remove from group
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <SectionTitle>Group</SectionTitle>
      <div className="space-y-2">
        {canLeaveGroup(myRole) ? (
          <Button
            variant="danger"
            full
            busy={busy === 'leave'}
            onClick={() => {
              if (confirm(`Leave ${group.name}? You'll need a new invite to come back.`)) {
                run('leave', () => leaveGroup(group.id), () => navigate('/groups', { replace: true }))
              }
            }}
          >
            <DoorOpen className="size-5" /> Leave group
          </Button>
        ) : (
          <p className="text-sm text-muted">You own this group. To leave, first make someone else the owner.</p>
        )}
        {canRenameOrDeleteGroup(myRole) && (
          <Button
            variant="danger"
            full
            busy={busy === 'delete'}
            onClick={() => {
              if (confirm(`Delete ${group.name} for everyone? This can't be undone.`)) {
                run('delete', () => deleteGroup(group.id), () => navigate('/groups', { replace: true }))
              }
            }}
          >
            <Trash2 className="size-5" /> Delete group
          </Button>
        )}
      </div>
    </>
  )
}

type MemberAction = 'promote' | 'demote' | 'transfer' | 'kick'

/** Which actions I can take on another member, per the permission table. */
function memberActions(myRole: Role, myId: string, member: GroupMember): MemberAction[] {
  if (member.user_id === myId) return []
  const actions: MemberAction[] = []
  if (canChangeRoles(myRole) && member.role === 'member') actions.push('promote')
  if (canChangeRoles(myRole) && member.role === 'manager') actions.push('demote')
  if (canTransferOwnership(myRole)) actions.push('transfer')
  if (canKick(myRole, member.role)) actions.push('kick')
  return actions
}

function GroupTitle({ name, canRename, onRename }: { name: string; canRename: boolean; onRename: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  if (!editing) {
    return (
      <PageHeader
        title={name}
        backTo="/groups"
        action={
          canRename && (
            <button
              className="flex size-11 items-center justify-center rounded-full text-muted active:bg-surface-2"
              aria-label="Rename group"
              onClick={() => {
                setDraft(name)
                setEditing(true)
              }}
            >
              <Pencil className="size-5" />
            </button>
          )
        }
      />
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim()) return
    await onRename(draft)
    setEditing(false)
  }

  return (
    <form className="mb-4 flex items-end gap-2" onSubmit={handleSubmit}>
      <div className="flex-1">
        <TextField label="Group name" name="groupName" maxLength={50} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
      </div>
      <Button type="button" variant="secondary" aria-label="Cancel" onClick={() => setEditing(false)}>
        <X className="size-5" />
      </Button>
      <Button type="submit" aria-label="Save name" disabled={!draft.trim()}>
        <Check className="size-5" />
      </Button>
    </form>
  )
}

function InviteForm({ groupId, onInvited }: { groupId: string; onInvited: () => Promise<void> }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input = value.trim()
    if (!input) return
    setBusy(true)
    setError(null)
    setSent(null)
    try {
      if (looksLikeEmail(input)) {
        await inviteByEmail(groupId, input)
        setSent(`Invite sent to ${input}. They'll see it when they sign in with that email.`)
      } else {
        await inviteByUsername(groupId, normalizeUsername(input))
        setSent(`Invite sent to @${normalizeUsername(input)}.`)
      }
      setValue('')
      await onInvited()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <TextField
          label="Username or email"
          name="invitee"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="@username or friend@email.com"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <ErrorMessage>{error}</ErrorMessage>
        {sent && <p className="text-sm text-good">{sent}</p>}
        <Button type="submit" full busy={busy} disabled={!value.trim()}>
          <UserPlus className="size-5" /> Send invite
        </Button>
      </form>
    </Card>
  )
}
