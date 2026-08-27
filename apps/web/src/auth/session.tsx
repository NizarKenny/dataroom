import { supabase } from '@/lib/supabase'
import { createContext, use, useEffect, useState, type ReactNode } from 'react'

interface Account {
  id: string
  email: string
}

type State = { status: 'loading' } | { status: 'out' } | { status: 'in'; account: Account }

const SessionContext = createContext<State>({ status: 'loading' })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    // Fires once with the session restored from storage, and again on every sign
    // in, sign out and token refresh, so there is nothing else to subscribe to.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      setState(
        user?.email
          ? { status: 'in', account: { id: user.id, email: user.email } }
          : { status: 'out' },
      )
    })

    return () => data.subscription.unsubscribe()
  }, [])

  return <SessionContext value={state}>{children}</SessionContext>
}

export function useSession() {
  return use(SessionContext)
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function signUp(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
}

export async function signOut() {
  await supabase.auth.signOut()
}
