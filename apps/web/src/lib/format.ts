import { d } from './dictionary'
import { current, say, type Locale } from './i18n'

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`

  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }

  // One decimal below ten, none above: 1.4 MB reads, 148.3 MB just looks busy.
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${UNITS[unit]}`
}

/**
 * Dates follow the language the interface is speaking, and Intl already knows
 * both. Built on demand rather than once at import: the locale can change while
 * the page is open, and a formatter made before it changed would keep saying
 * "22 minutes ago" under a Ukrainian heading.
 */
const formatters = (locale: Locale) => {
  const tag = locale === 'ua' ? 'uk' : 'en'
  return {
    relative: new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }),
    sameYear: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' }),
    otherYear: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric' }),
  }
}

/** Recent things get a relative time, older things get a date. */
export function formatWhen(iso: string): string {
  const then = new Date(iso)
  const minutes = Math.round((then.getTime() - Date.now()) / 60_000)
  const { relative, sameYear, otherYear } = formatters(current())

  if (minutes > -1) return say(d.common.justNow)
  if (minutes > -60) return relative.format(minutes, 'minute')
  if (minutes > -60 * 24) return relative.format(Math.round(minutes / 60), 'hour')
  if (minutes > -60 * 24 * 7) return relative.format(Math.round(minutes / (60 * 24)), 'day')

  return then.getFullYear() === new Date().getFullYear()
    ? sameYear.format(then)
    : otherYear.format(then)
}

export function initialsOf(email: string): string {
  const [name = ''] = email.split('@')
  const parts = name.split(/[.\-_]/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0]?.[0]}${parts[1]?.[0]}` : name.slice(0, 2)).toUpperCase()
}

const TYPE_NAMES: Record<string, string> = {
  'application/pdf': 'PDF',
  'text/csv': 'CSV',
  'text/plain': 'Text',
}

/** What to call a file in front of a reader. "application/pdf" is not it. */
export function describeType(mimeType: string): string {
  const type = mimeType.split(';')[0]?.trim() ?? ''
  if (TYPE_NAMES[type]) return TYPE_NAMES[type]
  if (type.startsWith('image/')) return 'Image'
  if (type.includes('word')) return 'Document'
  if (type.includes('sheet') || type.includes('excel')) return 'Spreadsheet'
  return 'File'
}
