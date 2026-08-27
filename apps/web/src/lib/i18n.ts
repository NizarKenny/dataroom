import { useSyncExternalStore } from 'react'

export type Locale = 'en' | 'ua'

/** One string in every language the interface speaks. */
export type Phrase = Record<Locale, string>

const KEY = 'dataroom.locale'
const LOCALES: Locale[] = ['en', 'ua']

function preferred(): Locale {
  const saved = localStorage.getItem(KEY)
  if (saved === 'en' || saved === 'ua') return saved
  // The browser's own list decides, and only Ukrainian is worth looking for:
  // everything else falls through to the language this was written in.
  return navigator.languages?.some((tag) => tag.toLowerCase().startsWith('uk')) ? 'ua' : 'en'
}

// One locale for the whole app, the way the theme is, so the switch in the
// header and a dialog three levels down can never disagree.
let locale = preferred()
const listeners = new Set<() => void>()
apply()

function apply() {
  document.documentElement.lang = locale === 'ua' ? 'uk' : 'en'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export { LOCALES }

export function useLocale() {
  const current = useSyncExternalStore(subscribe, () => locale)

  return {
    locale: current,
    set(next: Locale) {
      locale = next
      localStorage.setItem(KEY, next)
      apply()
      for (const listener of listeners) listener()
    },
  }
}

/**
 * The same lookup outside React, for the two places that cannot hold a hook: a
 * class error boundary, and anything that runs before the tree is drawn.
 */
export const say = (phrase: Phrase) => phrase[locale]

/** `const t = useT()`, then `t(d.browser.newFolder)`. */
export function useT() {
  const { locale: current } = useLocale()
  return (phrase: Phrase) => phrase[current]
}
