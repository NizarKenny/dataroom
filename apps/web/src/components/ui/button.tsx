import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'

/**
 * The four buttons from the style reference. Pill shaped, one blue, and a danger
 * button that stays quiet until it is hovered, because deleting a folder in a data
 * room is not a thing to invite with a red block.
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
      },
      size: {
        md: 'px-4 py-[7px] text-[15px] leading-normal',
        sm: 'px-3 py-1 text-sm',
        icon: 'size-8 rounded-md',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof button> & { asChild?: boolean }

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : 'button'
  return <Component className={cn(button({ variant, size }), className)} {...props} />
}
