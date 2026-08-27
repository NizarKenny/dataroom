import { signOut, useSession } from '@/auth/session'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { initialsOf } from '@/lib/format'
import { useTheme } from '@/theme'
import { Moon, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function TopBar({ children }: { children?: ReactNode }) {
  const session = useSession()
  const { theme, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-4 px-6">
        <Link to="/" className="font-semibold tracking-[-0.02em]">
          Data Room
        </Link>

        <div className="flex-1">{children}</div>

        <Button
          variant="utility"
          size="icon"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>

        {session.status === 'in' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="grid size-8 place-items-center rounded-full bg-secondary-wash text-[11px] font-semibold text-secondary"
                aria-label="Account"
              >
                {initialsOf(session.account.email)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal text-ink-muted">
                {session.account.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut()}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
