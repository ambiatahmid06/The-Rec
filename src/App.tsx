import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { Button, ErrorMessage, LoadingScreen } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'
import { supabaseConfigured } from './lib/supabase'
import { EditProfile } from './pages/EditProfile'
import { GroupDetail } from './pages/GroupDetail'
import { Groups } from './pages/Groups'
import { Home } from './pages/Home'
import { Profile } from './pages/Profile'
import { ResetPassword } from './pages/ResetPassword'
import { SignIn } from './pages/SignIn'
import { Stats } from './pages/Stats'
import { Welcome } from './pages/Welcome'

export default function App() {
  if (!supabaseConfigured) return <SetupNeeded />

  return (
    <BrowserRouter>
      <AuthProvider>
        <RecoveryRedirect />
        <Routes>
          <Route path="/sign-in" element={<SignedOutOnly />}>
            <Route index element={<SignIn />} />
          </Route>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/welcome" element={<Welcome />} />

          <Route element={<RequireProfile />}>
            <Route element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="stats" element={<Stats />} />
              <Route path="profile" element={<Profile />} />
              <Route path="profile/edit" element={<EditProfile />} />
              <Route path="groups" element={<Groups />} />
              <Route path="groups/:groupId" element={<GroupDetail />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

/** Pages that need a signed-in user who has finished setting up their profile. */
function RequireProfile() {
  const { session, profile, loading, profileError, refreshProfile } = useAuth()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/sign-in" replace />
  if (profileError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
        <ErrorMessage>{profileError}</ErrorMessage>
        <Button onClick={refreshProfile}>Try again</Button>
      </div>
    )
  }
  if (!profile) return <Navigate to="/welcome" replace />
  return <Outlet />
}

function SignedOutOnly() {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}

/** A password-reset email link signs the user in; send them to pick a new password. */
function RecoveryRedirect() {
  const { isRecovery } = useAuth()
  const { pathname } = useLocation()
  if (isRecovery && pathname !== '/reset-password') return <Navigate to="/reset-password" replace />
  return null
}

function SetupNeeded() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-3 font-display text-3xl font-bold uppercase">Almost there</h1>
      <p className="text-muted">
        The app can't find its Supabase settings. Copy <code>.env.example</code> to <code>.env.local</code>, fill in
        your project URL and publishable key, then restart <code>npm run dev</code>.
      </p>
    </div>
  )
}
