import { LOCALES, useLocale, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const NAMES: Record<Locale, string> = { en: 'EN', ua: 'UA' }

/**
 * Two words rather than a flag and a menu. There are two languages, both fit,
 * and a switch you can read is faster than one you have to open.
 */
export function LanguageSwitch() {
  const { locale, set } = useLocale()

  return (
    <div className="flex gap-0.5 rounded-md bg-sunken p-0.5" role="group" aria-label="Language">
      {LOCALES.map((option) => (
        <button
          key={option}
          onClick={() => set(option)}
          aria-pressed={locale === option}
          className={cn(
            'rounded-[5px] px-2 py-1 text-xs font-semibold tracking-[0.125px] transition-colors',
            locale === option
              ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,.06)]'
              : 'text-ink-faint hover:text-ink-muted',
          )}
        >
          {NAMES[option]}
        </button>
      ))}
    </div>
  )
}
