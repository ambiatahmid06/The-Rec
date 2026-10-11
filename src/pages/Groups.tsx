import { ChevronRight, Users } from 'lucide-react'
import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, ErrorMessage, RoleBadge, SectionTitle, Spinner, TextField } from '../components/ui'
import { useAuth } from '../lib/auth'
import { createGroup, fetchMyGroups } from '../lib/groups'
import { useAsync } from '../lib/useAsync'

export function Groups() {
  const { profile } = useAuth()
  const userId = profile!.id
  const navigate = useNavigate()
  const groups = useAsync(useCallback(() => fetchMyGroups(userId), [userId]))

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    try {
      const groupId = await createGroup(name)
      navigate(`/groups/${groupId}`)
    } catch (e) {
      setError((e as Error).message)
      setCreating(false)
    }
  }

  return (
    <>
      <PageHeader title="My groups" backTo="/profile" />

      <Card>
        <form className="space-y-3" onSubmit={handleCreate}>
          <TextField
            label="New group"
            name="groupName"
            placeholder="e.g. Sunday Morning Run"
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <ErrorMessage>{error}</ErrorMessage>
          <Button type="submit" full busy={creating} disabled={!name.trim()}>
            Create group
          </Button>
        </form>
      </Card>

      <SectionTitle>Your groups</SectionTitle>
      {groups.loading && !groups.data ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : groups.error ? (
        <ErrorMessage>{groups.error}</ErrorMessage>
      ) : groups.data!.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          message="Create one above, or ask a friend to invite you. Invites show up on your Home tab."
        />
      ) : (
        <div className="space-y-2">
          {groups.data!.map((group) => (
            <Link
              key={group.id}
              to={`/groups/${group.id}`}
              className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 active:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{group.name}</p>
                <p className="text-sm text-muted">
                  {group.member_count} {group.member_count === 1 ? 'player' : 'players'}
                </p>
              </div>
              <RoleBadge role={group.my_role} />
              <ChevronRight className="size-5 text-muted" />
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
