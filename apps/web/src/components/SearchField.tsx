import { Input } from '@/components/ui/input'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { Search, X } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

export function SearchField({ value, onChange, placeholder }: Props) {
  const t = useT()

  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" />
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
        // Escape is what people already press to get out of a search box.
        onKeyDown={(event) => event.key === 'Escape' && onChange('')}
        // Safari and Chrome draw their own clear button on a search input, and
        // two of them side by side is one too many.
        className="pr-8 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          aria-label={t(d.browser.clearSearch)}
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-ink-faint hover:text-ink"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
