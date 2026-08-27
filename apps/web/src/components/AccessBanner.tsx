import { Button } from '@/components/ui/button'
import type { AccessBadge } from '@/lib/api'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
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
  const t = useT()

  const who: string[] = []
  if (access.people > 0) who.push(t(d.access.peopleCount(access.people)))
  if (access.link) who.push(t(d.access.anyoneWithLink))
  if (who.length === 0) return null
  const said = who.join(t(d.access.and))

  const grantedHere = access.here.people > 0 || access.here.link

  return (
    <div className="flex items-center gap-2 border-b border-hairline bg-primary-wash px-4 py-2.5 text-[13px] text-primary-active">
      <Users className="size-3.5 shrink-0" />
      <span className="flex-1">
        {grantedHere
          ? t(d.access.sharedWith(said))
          : grantedAtName
            ? t(d.access.visibleToAt(said, grantedAtName))
            : t(d.access.visibleToAbove(said))}
      </span>
      <Button
        variant="utility"
        size="sm"
        onClick={onManage}
        className="text-primary-active underline underline-offset-2"
      >
        {t(grantedHere ? d.access.manage : d.access.seeWho)}
      </Button>
    </div>
  )
}
