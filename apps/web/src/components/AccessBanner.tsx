import { Button } from '@/components/ui/button'
import type { AccessBadge } from '@/lib/api'
import { Users } from 'lucide-react'

interface Props {
  access: AccessBadge
  /** The name of the folder access came from, when it came from above. */
  grantedAtName: string | null
  onManage: () => void
}

/**
 * Said once at the top of a listing rather than repeated on every row. The rails
 * down the left of the table then only have to mean "this one too".
 */
export function AccessBanner({ access, grantedAtName, onManage }: Props) {
  const who: string[] = []
  if (access.people > 0) {
    who.push(`${access.people} ${access.people === 1 ? 'person' : 'people'}`)
  }
  if (access.link) who.push('anyone with the link')
  if (who.length === 0) return null

  const grantedHere = access.here.people > 0 || access.here.link

  return (
    <div className="flex items-center gap-2 border-b border-hairline bg-primary-wash px-4 py-2.5 text-[13px] text-primary-active">
      <Users className="size-3.5 shrink-0" />
      <span className="flex-1">
        {grantedHere
          ? `This folder is shared with ${who.join(' and ')}.`
          : grantedAtName
            ? `Everything here is visible to ${who.join(' and ')}, granted on ${grantedAtName}.`
            : `Everything here is visible to ${who.join(' and ')}, granted on a folder above.`}
      </span>
      <Button
        variant="utility"
        size="sm"
        onClick={onManage}
        className="text-primary-active underline underline-offset-2"
      >
        {grantedHere ? 'Manage' : 'See who'}
      </Button>
    </div>
  )
}
