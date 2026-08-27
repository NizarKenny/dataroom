import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { Link2, Users } from 'lucide-react'

interface Props {
  /** The folder the reader's access starts at, which is where their trail begins. */
  grantedAt: string
  through: 'invitation' | 'link'
}

/**
 * The owner's side of this product explains itself: a banner, a chip on a row, a
 * rail down rows that inherit. The reader saw none of it and got a bare file list
 * with a blue tick nobody had explained. This is their half of the same sentence,
 * and it is the first thing on their first screen.
 */
export function ReaderBanner({ grantedAt, through }: Props) {
  const t = useT()

  return (
    <div className="flex items-center gap-2 border-b border-hairline bg-primary-wash px-4 py-2.5 text-[13px] text-primary-active">
      {through === 'link' ? (
        <Link2 className="size-3.5 shrink-0" />
      ) : (
        <Users className="size-3.5 shrink-0" />
      )}
      <span>
        {t(d.access.readerFolder(grantedAt))}{' '}
        {t(through === 'link' ? d.access.readerRestLink : d.access.readerRestInvite)}
      </span>
    </div>
  )
}
