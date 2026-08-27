import { Button } from '@/components/ui/button'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { pageWindow, windowFor } from '@/lib/pager'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

interface Props {
  page: number
  pages: number
  onGoTo: (page: number) => void
}

/**
 * Three page numbers and two arrows. The arrows scroll the numbers rather than
 * turning the page, which is why they go dead as soon as the window is against
 * an end: with three pages or fewer they never wake up at all.
 */
export function Pager({ page, pages, onGoTo }: Props) {
  const t = useT()
  const [start, setStart] = useState(() => windowFor(page, pages))

  // A page can arrive from somewhere other than these buttons: a link carrying
  // ?page=, or a folder that lost rows and got shorter under the reader.
  useEffect(() => {
    setStart((current) =>
      pageWindow(pages, current).numbers.includes(page) ? current : windowFor(page, pages),
    )
  }, [page, pages])

  const { numbers, canGoBack, canGoForward } = pageWindow(pages, start)
  if (pages < 2) return null

  return (
    <nav
      aria-label={t(d.pager.label)}
      className="flex items-center justify-center gap-1 border-t border-hairline px-4 py-3"
    >
      <Arrow
        label={t(d.pager.earlier)}
        disabled={!canGoBack}
        onClick={() => setStart((n) => n - 1)}
      >
        <ChevronLeft />
      </Arrow>

      {numbers.map((number) => (
        <Button
          key={number}
          variant="utility"
          size="icon"
          aria-label={t(d.pager.page(number))}
          aria-current={number === page ? 'page' : undefined}
          onClick={() => onGoTo(number)}
          className={cn('tabular', number === page && 'bg-sunken font-semibold text-ink')}
        >
          {number}
        </Button>
      ))}

      <Arrow
        label={t(d.pager.later)}
        disabled={!canGoForward}
        onClick={() => setStart((n) => n + 1)}
      >
        <ChevronRight />
      </Arrow>
    </nav>
  )
}

/** Blue while it has somewhere to go, and the ordinary disabled grey once it does not. */
function Arrow({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant="utility"
      size="icon"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={disabled ? undefined : 'text-primary'}
    >
      {children}
    </Button>
  )
}
