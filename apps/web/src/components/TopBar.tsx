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
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { d } from '@/lib/dictionary'
import { initialsOf } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { useTheme } from '@/theme'
import { Moon, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function TopBar({ children }: { children?: ReactNode }) {
  const session = useSession()
  const { theme, toggle } = useTheme()
  const t = useT()

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link to="/" className="shrink-0 font-semibold tracking-[-0.02em] whitespace-nowrap">
          Data Room
        </Link>

        {/* The room name is the only thing here allowed to give up space, and it
            gives it up by truncating rather than by wrapping the bar to two lines. */}
        <div className="min-w-0 flex-1">{children}</div>

        <Button
          variant="utility"
          size="icon"
          onClick={toggle}
          aria-label={t(theme === 'dark' ? d.theme.toLight : d.theme.toDark)}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>

        <LanguageSwitch />

        {session.status === 'in' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="grid size-8 place-items-center rounded-full bg-secondary-wash text-[11px] font-semibold text-secondary"
                aria-label={t(d.common.account)}
              >
                {initialsOf(session.account.email)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal text-ink-muted">
                {session.account.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut()}>
                {t(d.common.signOut)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
