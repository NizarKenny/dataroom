import { signIn, signUp, useSession } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export function SignIn() {
  const session = useSession()
  const location = useLocation()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session.status === 'in') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await (mode === 'in' ? signIn(email, password) : signUp(email, password))
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That did not work')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="w-full max-w-[360px]">
        <h1 className="text-[32px] leading-tight font-bold tracking-[-0.02em]">Data Room</h1>
        <p className="mt-2 text-ink-muted">
          {mode === 'in'
            ? 'Sign in to reach the rooms shared with you.'
            : 'Create an account to open your first data room.'}
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <Label htmlFor="email" className="mb-1.5 text-ink-secondary">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="password" className="mb-1.5 text-ink-secondary">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === 'up' && (
              <p className="mt-1.5 text-[13px] text-ink-muted">At least 8 characters.</p>
            )}
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}

          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {busy ? 'One moment' : mode === 'in' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <p className="mt-5 text-[13px] text-ink-muted">
          {mode === 'in' ? 'No account yet?' : 'Already have an account?'}{' '}
          <button
            type="button"
            className="text-primary underline underline-offset-2"
            onClick={() => {
              setMode(mode === 'in' ? 'up' : 'in')
              setError(null)
            }}
          >
            {mode === 'in' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
