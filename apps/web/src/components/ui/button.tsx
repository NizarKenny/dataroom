import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'

/**
 * The buttons from the style reference. Pill shaped, one blue, and two reds that
 * are not interchangeable: `danger` is the trigger, quiet until hovered because a
 * confirming dialog stands behind it, and `destructive` is the button inside that
 * dialog, filled because nothing stands behind it.
 */
const button = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-colors select-none whitespace-nowrap disabled:opacity-45 disabled:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'rounded-full bg-primary text-on-primary hover:bg-primary-active',
        secondary:
          'rounded-full bg-surface text-ink border border-hairline-strong hover:bg-sunken',
        utility: 'rounded-md bg-transparent text-ink-secondary hover:bg-sunken',
        danger:
          'rounded-full bg-transparent text-danger border border-hairline-strong hover:bg-danger-wash hover:border-danger',
        destructive: 'rounded-full bg-danger text-white hover:brightness-110',
      },
      size: {
        md: 'px-4 py-[7px] text-[15px] leading-normal',
        sm: 'px-3 py-1 text-sm',
        icon: 'size-8 rounded-md',
      },
    },
    // A row level utility is smaller than a button that acts on the room, and
    // the reference sets that on the variant, not the size.
    compoundVariants: [{ variant: 'utility', size: 'md', class: 'px-3 py-1' }],
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof button> & { asChild?: boolean }

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : 'button'
  return <Component className={cn(button({ variant, size }), className)} {...props} />
}
