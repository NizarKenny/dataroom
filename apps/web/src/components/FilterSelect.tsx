import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, type LucideIcon } from 'lucide-react'

export interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  icon?: LucideIcon
  /** Shown only while the filter is at its default, so a row of these reads as
   *  the filters that are on rather than as a row of captions. */
  label: string
  value: T
  /** The value that means no filter. */
  off: T
  options: Option<T>[]
  onChange: (value: T) => void
}

/**
 * One choice on the toolbar. It shows the chosen value rather than the name of
 * the field, and tints once it is filtering, so a narrowed list says so without
 * being opened.
 */
export function FilterSelect<T extends string>({
  icon: Icon,
  label,
  value,
  off,
  options,
  onChange,
}: Props<T>) {
  const engaged = value !== off
  const chosen = options.find((option) => option.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className={cn(
            'rounded-md px-2.5 py-[7px] text-sm',
            engaged && 'border-primary/40 bg-primary-wash text-primary-active',
          )}
        >
          {Icon && <Icon />}
          {engaged ? (chosen?.label ?? label) : label}
          <ChevronDown className="text-ink-faint" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onChange(option.value)}>
            <Check className={option.value === value ? undefined : 'invisible'} />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
