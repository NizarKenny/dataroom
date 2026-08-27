import { signIn, signUp, useSession } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { Label } from '@/components/ui/label'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export function SignIn() {
  const t = useT()
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
      setError(problem instanceof Error ? problem.message : t(d.common.didNotWork))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="w-full max-w-[360px]">
        <h1 className="text-[40px] leading-[1.1] font-bold tracking-[-1px]">Data Room</h1>
        <p className="mt-2 text-ink-muted">
          {t(mode === 'in' ? d.signIn.signInLede : d.signIn.createLede)}
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <Label htmlFor="email" className="mb-1.5 text-ink-secondary">
              {t(d.signIn.email)}
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
              {t(d.signIn.password)}
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
              <p className="mt-1.5 text-[13px] text-ink-muted">{t(d.signIn.passwordHint)}</p>
            )}
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}

          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {t(
              busy ? d.common.oneMoment : mode === 'in' ? d.signIn.signIn : d.signIn.createAccount,
            )}
          </Button>
        </form>

        <p className="mt-5 text-[13px] text-ink-muted">
          {t(mode === 'in' ? d.signIn.noAccount : d.signIn.haveAccount)}{' '}
          <button
            type="button"
            className="text-primary underline underline-offset-2"
            onClick={() => {
              setMode(mode === 'in' ? 'up' : 'in')
              setError(null)
            }}
          >
            {t(mode === 'in' ? d.signIn.createOne : d.signIn.signIn)}
          </button>
        </p>
      </div>
    </div>
  )
}
