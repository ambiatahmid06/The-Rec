import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button, Card, ErrorMessage, LoadingScreen, TextField } from '../components/ui'
import { useAuth } from '../lib/auth'
import { createProfile } from '../lib/profiles'
import { displayNameError, normalizeUsername, usernameError } from '../lib/validation'

/** First sign-in: pick a username and display name. */
export function Welcome() {
  const { session, profile, loading, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/sign-in" replace />
  if (profile) return <Navigate to="/" replace />

  const cleanUsername = normalizeUsername(username)
  const usernameProblem = usernameError(cleanUsername)
  const displayNameProblem = displayNameError(displayName)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (usernameProblem || displayNameProblem) return
    setBusy(true)
    setError(null)
    try {
      await createProfile(session!.user.id, cleanUsername, displayName)
      await refreshProfile()
      navigate('/', { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-1 font-display text-4xl font-bold uppercase tracking-wide">Welcome to the Rec</h1>
      <p className="mb-6 text-muted">Pick how your friends will find you and see you on the scoreboard.</p>
      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <TextField
            label="Username"
            name="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. splash_bro"
            hint="Friends invite you with this. Letters, numbers and underscores."
            error={touched ? usernameProblem : null}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label="Display name"
            name="displayName"
            autoComplete="name"
            placeholder="e.g. Steph"
            hint="Shown on scoreboards and stats."
            error={touched ? displayNameProblem : null}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <ErrorMessage>{error}</ErrorMessage>
          <Button type="submit" full busy={busy}>
            Let's go
          </Button>
        </form>
      </Card>
      <button className="mt-4 p-2 text-sm text-muted" onClick={signOut}>
        Sign out
      </button>
    </div>
  )
}
