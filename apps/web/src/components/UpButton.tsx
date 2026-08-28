import { Button } from '@/components/ui/button'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowLeft } from 'lucide-react'

interface Props {
  /** Where it lands, named so the button can say it rather than imply it. */
  to: string
  onClick: () => void
}

/** Up one level, which the trail can also do but only through a smaller target. */
export function UpButton({ to, onClick }: Props) {
  const t = useT()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="utility"
          size="icon"
          onClick={onClick}
          aria-label={t(d.browser.backTo(to))}
        >
          <ArrowLeft />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t(d.browser.backTo(to))}</TooltipContent>
    </Tooltip>
  )
}
