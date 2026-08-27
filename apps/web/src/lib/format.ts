const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`

  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }

  // One decimal below ten, none above: 1.4 MB reads, 148.3 MB just looks busy.
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${UNITS[unit]}`
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const sameYear = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })
const otherYear = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' })

/** Recent things get a relative time, older things get a date. */
export function formatWhen(iso: string): string {
  const then = new Date(iso)
  const minutes = Math.round((then.getTime() - Date.now()) / 60_000)

  if (minutes > -1) return 'just now'
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
