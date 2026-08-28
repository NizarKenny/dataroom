import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useColumns } from '@/lib/columns'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { Lock, LockOpen } from 'lucide-react'

/**
 * The switch between the two things a header can be. Closed, the headers sort
 * the list; open, they come loose and can be dragged into another order. It
 * starts closed because sorting is what people do every day and rearranging is
 * what they do once.
 */
export function LockButton() {
  const columns = useColumns()
  const t = useT()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="utility"
          size="icon"
          onClick={columns.toggleLock}
          aria-pressed={columns.unlocked}
          aria-label={t(columns.unlocked ? d.columns.lock : d.columns.unlock)}
          className={columns.unlocked ? 'text-primary' : 'text-ink-faint'}
        >
          {columns.unlocked ? <LockOpen /> : <Lock />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t(columns.unlocked ? d.columns.lock : d.columns.unlock)}</TooltipContent>
    </Tooltip>
  )
}
