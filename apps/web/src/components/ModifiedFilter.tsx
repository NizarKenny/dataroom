import { FilterSelect } from '@/components/FilterSelect'
import type { Modified } from '@/lib/api'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { CalendarClock } from 'lucide-react'

/**
 * Windows rather than a date picker. On a deal the question is "what has moved
 * since I last looked", and nobody answers that by typing two dates.
 */
const WINDOWS = [
  { value: 'any', phrase: d.modified.any },
  { value: 'today', phrase: d.modified.today },
  { value: 'week', phrase: d.modified.week },
  { value: 'month', phrase: d.modified.month },
  { value: 'year', phrase: d.modified.year },
] as const

export function ModifiedFilter({
  value,
  onChange,
}: {
  value: Modified
  onChange: (value: Modified) => void
}) {
  const t = useT()

  return (
    <FilterSelect
      icon={CalendarClock}
      label={t(d.modified.label)}
      value={value}
      off="any"
      options={WINDOWS.map((window) => ({ value: window.value, label: t(window.phrase) }))}
      onChange={onChange}
    />
  )
}
