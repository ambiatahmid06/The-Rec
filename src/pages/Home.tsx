import { Mail, Trophy, Users } from 'lucide-react'
import { useCallback, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { Button, ButtonLink, Card, ErrorMessage, SectionTitle, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'
import { fetchMyGroups, fetchMyInvites, respondToInvite } from '../lib/groups'
import { useAsync } from '../lib/useAsync'

export function Home() {
  const { session, profile } = useAuth()
  const userId = session!.user.id

  const groups = useAsync(useCallback(() => fetchMyGroups(userId), [userId]))
  const invites = useAsync(fetchMyInvites)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  async function respond(inviteId: string, accept: boolean) {
    setRespondingTo(inviteId)
    setInviteError(null)
    try {
      await respondToInvite(inviteId, accept)
      await Promise.all([invites.reload(), groups.reload()])
    } catch (e) {
      setInviteError((e as Error).message)
    } finally {
      setRespondingTo(null)
    }
  }

  const hasGroups = (groups.data?.length ?? 0) > 0

  return (
    <>
      <header className="mb-6">
        <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-accent">The Rec</p>
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide">Hey, {profile!.display_name}</h1>
      </header>

      {invites.data && invites.data.length > 0 && (
        <section className="mb-6">
          <SectionTitle>Invites</SectionTitle>
          <div className="space-y-3">
            {invites.data.map((invite) => (
              <Card key={invite.invite_id}>
                <div className="mb-3 flex items-start gap-3">
                  <Mail className="mt-0.5 size-5 shrink-0 text-accent" />
                  <div>
                    <p className="font-semibold">{invite.group_name}</p>
                    <p className="text-sm text-muted">
                      {invite.invited_by_name ? `${invite.invited_by_name} invited you` : 'You were invited'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    disabled={respondingTo !== null}
                    busy={respondingTo === invite.invite_id}
                    onClick={() => respond(invite.invite_id, false)}
                  >
                    Decline
                  </Button>
                  <Button
                    disabled={respondingTo !== null}
                    busy={respondingTo === invite.invite_id}
                    onClick={() => respond(invite.invite_id, true)}
                  >
                    Join
                  </Button>
                </div>
              </Card>
            ))}
            <ErrorMessage>{inviteError}</ErrorMessage>
          </div>
        </section>
      )}

      {groups.loading && !groups.data ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : groups.error ? (
        <ErrorMessage>{groups.error}</ErrorMessage>
      ) : hasGroups ? (
        <EmptyState
          icon={Trophy}
          title="No games yet"
          message="Game setup and live scoring are coming in the next update."
        />
      ) : (
        <EmptyState
          icon={Users}
          title="No groups yet"
          message="Create a group for your crew, or ask a friend to invite you to theirs."
          action={<ButtonLink to="/groups">Create a group</ButtonLink>}
        />
      )}
    </>
  )
}
