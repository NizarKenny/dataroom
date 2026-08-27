import { cn } from '@/lib/utils'
import type { ComponentProps } from 'react'

/**
 * The field from the style reference: one size at 15px, a 5px radius, a real
 * border rather than a shadow, and the focus outline drawn inside the edge.
 *
 * That inset is the single documented departure from the one focus treatment in
 * index.css. Same colour, same width; only the offset changes, because an outset
 * ring on a full width field collides with the edge of the dialog holding it.
 */
export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'w-full min-w-0 rounded-sm border border-hairline-strong bg-surface px-2.5 py-[7px]',
        'text-[15px] text-ink outline-none placeholder:text-ink-faint',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45',
        'focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-primary',
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  )
}
