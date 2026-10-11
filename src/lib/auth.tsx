// Keeps track of who is signed in and their profile, for the whole app.
import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchProfile } from './profiles'
import { supabase } from './supabase'
import type { Profile } from './types'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  /** True until we know whether someone is signed in and have loaded their profile. */
  loading: boolean
  profileError: string | null
  /** True after opening a password-reset link, until the new password is saved. */
  isRecovery: boolean
  endRecovery: () => void
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setSessionLoaded(true)
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  const refreshProfile = useCallback(async () => {
    if (!userId) return
    try {
      setProfile(await fetchProfile(userId))
      setProfileError(null)
    } catch (error) {
      setProfileError((error as Error).message)
    } finally {
      setProfileLoadedFor(userId)
    }
  }, [userId])

  // Load the profile whenever a different user signs in.
  useEffect(() => {
    if (!userId) return
    let cancelled = false // ignore a slow response for a user who already signed out
    fetchProfile(userId).then(
      (loaded) => {
        if (cancelled) return
        setProfile(loaded)
        setProfileError(null)
        setProfileLoadedFor(userId)
      },
      (error: Error) => {
        if (cancelled) return
        setProfileError(error.message)
        setProfileLoadedFor(userId)
      },
    )
    return () => {
      cancelled = true
    }
  }, [userId])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setProfileLoadedFor(null)
  }, [])

  const value: AuthContextValue = {
    session,
    profile,
    loading: !sessionLoaded || (userId !== null && profileLoadedFor !== userId),
    profileError,
    isRecovery,
    endRecovery: () => setIsRecovery(false),
    refreshProfile,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
