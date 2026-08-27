import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { COLUMNS, useColumns } from '@/lib/columns'
import { ArrowDown, ArrowUp, Check, Columns3 } from 'lucide-react'

/**
 * Dragging the headers is the quick way to arrange them. This is the same thing
 * reachable from the keyboard, and the only place a column can be switched off.
 */
export function ColumnsMenu() {
  const columns = useColumns()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="utility"
          size="icon"
          className="text-ink-faint"
          aria-label="Choose and arrange the columns"
        >
          <Columns3 />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {columns.layout.order.map((id, index) => {
          const column = COLUMNS.find((candidate) => candidate.id === id)
          if (!column) return null
          const shown = !columns.layout.hidden.includes(id)

          return (
            <div key={id} className="flex items-center gap-1 pr-1">
              <DropdownMenuItem
                className="flex-1"
                // The menu stays open: arranging columns is several decisions,
                // not one, and reopening it between each is the annoying part.
                onSelect={(event) => {
                  event.preventDefault()
                  columns.toggle(id)
                }}
              >
                <Check className={shown ? undefined : 'invisible'} />
                {column.label}
              </DropdownMenuItem>

              <Button
                variant="utility"
                size="icon"
                aria-label={`Move ${column.label} left`}
                disabled={index === 0}
                onClick={() => columns.nudge(id, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="utility"
                size="icon"
                aria-label={`Move ${column.label} right`}
                disabled={index === columns.layout.order.length - 1}
                onClick={() => columns.nudge(id, 1)}
              >
                <ArrowDown />
              </Button>
            </div>
          )
        })}

        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={columns.isDefault} onSelect={() => columns.reset()}>
          Reset to the default
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
