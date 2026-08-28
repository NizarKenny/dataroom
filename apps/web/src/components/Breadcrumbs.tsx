import { cn } from '@/lib/utils'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { ChevronRight } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'

interface Props {
  trail: { id: string; name: string }[]
  onNavigate: (id: string) => void
  /** True when the first crumb is where the reader's own access begins. */
  granted?: boolean
  /** Sits at the far end of the row. The lock over the columns lives here. */
  children?: ReactNode
}

export function Breadcrumbs({ trail, onNavigate, granted = false, children }: Props) {
  const t = useT()

  return (
    <nav
      aria-label={t(d.browser.breadcrumb)}
      className="flex items-center gap-1.5 border-b border-hairline px-4 py-1.5 text-[13px] text-ink-muted"
    >
      {trail.map((crumb, index) => {
        const here = index === trail.length - 1
        return (
          <Fragment key={crumb.id}>
            {index > 0 && <ChevronRight className="size-3.5 text-ink-faint" />}
            <button
              onClick={() => onNavigate(crumb.id)}
              disabled={here}
              className={cn(
                'truncate',
                here && 'font-medium text-ink',
                // Where a reader's access starts, marked the way the rail marks a
                // row: same line, same blue, same meaning.
                granted &&
                  index === 0 &&
                  "relative pl-2.5 font-medium text-primary-active before:absolute before:inset-y-[-12px] before:left-0 before:w-0.5 before:bg-primary before:content-['']",
              )}
            >
              {crumb.name}
            </button>
          </Fragment>
        )
      })}

      {children && <span className="ml-auto flex items-center">{children}</span>}
    </nav>
  )
}
