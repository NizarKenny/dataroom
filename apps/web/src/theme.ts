import { useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

const KEY = 'dataroom.theme'
const listeners = new Set<() => void>()

function preferred(): Theme {
  const saved = localStorage.getItem(KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// One value for the whole app rather than a hook with its own state per caller,
// so the switch in the header and the toasts can never disagree.
let theme = preferred()
apply()

function apply() {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => theme)

  return {
    theme: current,
    toggle() {
      theme = current === 'dark' ? 'light' : 'dark'
      localStorage.setItem(KEY, theme)
      apply()
      for (const listener of listeners) listener()
    },
  }
}
