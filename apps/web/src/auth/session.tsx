import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react'

interface Account {
  id: string
  email: string
}

type State = { status: 'loading' } | { status: 'out' } | { status: 'in'; account: Account }

const SessionContext = createContext<State>({ status: 'loading' })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const queryClient = useQueryClient()
  const signedInAs = useRef<string | null>(null)

  useEffect(() => {
    // Fires once with the session restored from storage, and again on every sign
    // in, sign out and token refresh, so there is nothing else to subscribe to.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user

      // Everything in the cache was fetched as somebody. Room names, file names
      // and who a folder is shared with are exactly what the next person at this
      // browser must not be handed, so the cache goes when the account does.
      if ((user?.id ?? null) !== signedInAs.current) {
        signedInAs.current = user?.id ?? null
        queryClient.clear()
      }

      setState(
        user?.email
          ? { status: 'in', account: { id: user.id, email: user.email } }
          : { status: 'out' },
      )
    })

    return () => data.subscription.unsubscribe()
  }, [queryClient])

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
