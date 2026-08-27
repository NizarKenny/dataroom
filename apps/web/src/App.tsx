import { useSession } from '@/auth/session'
import { Toaster } from '@/components/Toaster'
import { Browser } from '@/routes/Browser'
import { LinkView } from '@/routes/LinkView'
import { Rooms } from '@/routes/Rooms'
import { SignIn } from '@/routes/SignIn'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

export function App() {
  return (
    <>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/l/:token" element={<LinkView />} />
        <Route path="/l/:token/f/:folderId" element={<LinkView />} />
        <Route
          path="/"
          element={
            <SignedIn>
              <Rooms />
            </SignedIn>
          }
        />
        <Route
          path="/f/:folderId"
          element={
            <SignedIn>
              <Browser />
            </SignedIn>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}

function SignedIn({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()

  // Nothing at all while the session is being restored: a flash of the sign-in
  // screen on every refresh is worse than a beat of empty canvas.
  if (session.status === 'loading') return <div className="min-h-dvh bg-canvas" />

  if (session.status === 'out') {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
