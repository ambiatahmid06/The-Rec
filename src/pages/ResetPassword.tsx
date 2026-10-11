import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button, ButtonLink, Card, ErrorMessage, LoadingScreen, TextField } from '../components/ui'
import { useAuth } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { MIN_PASSWORD_LENGTH } from '../lib/validation'

/** Opened from the "reset your password" email link, which signs the user in temporarily. */
export function ResetPassword() {
  const { session, loading, endRecovery } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <LoadingScreen />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setError(friendlyError(error))
      return
    }
    endRecovery()
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Card>
        <h1 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide">New password</h1>
        {session ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <TextField
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextField
              label="Confirm new password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <ErrorMessage>{error}</ErrorMessage>
            <Button type="submit" full busy={busy}>
              Save password
            </Button>
          </form>
        ) : (
          <>
            <p className="mb-5 text-muted">This reset link has expired or was already used. Request a new one.</p>
            <ButtonLink to="/sign-in" variant="secondary">
              Back to sign in
            </ButtonLink>
          </>
        )}
      </Card>
    </div>
  )
}
