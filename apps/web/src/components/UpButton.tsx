import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowLeft } from 'lucide-react'

interface Props {
  /** Where it lands, named so the button can say it rather than imply it. */
  to: string
  onClick: () => void
}

/**
 * The trail says where you are; this says how to leave. Going up one level is
 * the move a reader makes over and over walking a tree, and aiming at the second
 * to last crumb every time is a smaller target for the same thing.
 */
export function UpButton({ to, onClick }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="utility" size="icon" onClick={onClick} aria-label={`Back to ${to}`}>
          <ArrowLeft />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Back to {to}</TooltipContent>
    </Tooltip>
  )
}
