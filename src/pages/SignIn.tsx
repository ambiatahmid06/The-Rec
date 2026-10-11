import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Card, ErrorMessage, TextField } from '../components/ui'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { MIN_PASSWORD_LENGTH } from '../lib/validation'

type Mode = 'sign-in' | 'sign-up' | 'forgot'

const TITLES: Record<Mode, string> = {
  'sign-in': 'Sign in',
  'sign-up': 'Create account',
  forgot: 'Reset password',
}

export function SignIn() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentMessage, setSentMessage] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (mode === 'sign-up' && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`)
      return
    }

    setBusy(true)
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // The auth listener notices the new session and routes onward.
      } else if (mode === 'sign-up') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        setSentMessage(
          `We sent a confirmation link to ${email}. Open it, then come back here and sign in.`,
        )
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setSentMessage(`If ${email} has an account, we sent it a link to reset the password.`)
      }
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <img src="/pwa-192x192.png" alt="" className="mx-auto mb-4 size-20 rounded-2xl" />
        <h1 className="font-display text-5xl font-bold uppercase tracking-wide">The Rec</h1>
        <p className="mt-1 text-muted">Pickup scores and stats for your crew.</p>
      </div>

      {sentMessage ? (
        <Card className="text-center">
          <MailCheck className="mx-auto mb-3 size-10 text-accent" strokeWidth={1.5} />
          <p className="mb-5">{sentMessage}</p>
          <Button
            variant="secondary"
            full
            onClick={() => {
              setSentMessage(null)
              switchMode('sign-in')
            }}
          >
            Back to sign in
          </Button>
        </Card>
      ) : (
        <Card>
          <h2 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide">{TITLES[mode]}</h2>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <TextField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {mode !== 'forgot' && (
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                required
                hint={mode === 'sign-up' ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            <ErrorMessage>{error}</ErrorMessage>
            <Button type="submit" full busy={busy}>
              {mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'}
            </Button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-1 text-sm">
            {mode === 'sign-in' ? (
              <>
                <button className="p-2 text-accent" onClick={() => switchMode('sign-up')}>
                  New here? Create an account
                </button>
                <button className="p-2 text-muted" onClick={() => switchMode('forgot')}>
                  Forgot password?
                </button>
              </>
            ) : (
              <button className="p-2 text-accent" onClick={() => switchMode('sign-in')}>
                Have an account? Sign in
              </button>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
