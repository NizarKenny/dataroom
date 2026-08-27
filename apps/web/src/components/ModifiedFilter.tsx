import { FilterSelect } from '@/components/FilterSelect'
import type { Modified } from '@/lib/api'
import { CalendarClock } from 'lucide-react'

/**
 * Windows rather than a date picker. On a deal the question is "what has moved
 * since I last looked", and nobody answers that by typing two dates.
 */
const WINDOWS: { value: Modified; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'today', label: 'Last 24 hours' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'year', label: 'Last 12 months' },
]

export function ModifiedFilter({
  value,
  onChange,
}: {
  value: Modified
  onChange: (value: Modified) => void
}) {
  return (
    <FilterSelect
      icon={CalendarClock}
      label="Modified"
      value={value}
      off="any"
      options={WINDOWS}
      onChange={onChange}
    />
  )
}
