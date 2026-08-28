import type { Row } from '@/components/FileTable'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { useQuery } from '@tanstack/react-query'
import { Folder } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Props {
  row: Row | null
  roomId: string
  currentFolderId: string
  onOpenChange: (open: boolean) => void
  onMove: (row: Row, folderId: string, folderName: string) => Promise<void>
}

export function MoveDialog({ row, roomId, currentFolderId, onOpenChange, onMove }: Props) {
  const t = useT()
  const [chosen, setChosen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const folders = useQuery({
    queryKey: ['room-folders', roomId],
    queryFn: () => api.rooms.folders(roomId),
    enabled: row !== null,
  })

  useEffect(() => {
    if (row) {
      setChosen(null)
      setError(null)
      setFilter('')
    }
  }, [row])

  // A folder cannot land inside itself, so its own subtree is not on offer.
  const forbidden = new Set<string>()
  if (row?.kind === 'folder' && folders.data) {
    forbidden.add(row.id)
    for (const folder of folders.data) {
      if (folder.parentId && forbidden.has(folder.parentId)) forbidden.add(folder.id)
    }
  }

  // A room with a hundred folders is a room where scrolling is not an answer.
  // Filtering flattens the tree on purpose: once you are typing a name, the
  // indentation is telling you about folders you are no longer looking at.
  const needle = filter.trim().toLowerCase()
  const shown = (folders.data ?? []).filter(
    (folder) => needle.length === 0 || folder.name.toLowerCase().includes(needle),
  )

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate">{t(d.move.title(row.name))}</DialogTitle>
              <DialogDescription>{t(d.move.lede)}</DialogDescription>
            </DialogHeader>

            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t(d.move.filter)}
              className="mt-4"
            />

            <div className="mt-2 max-h-[280px] overflow-y-auto rounded-md border border-hairline">
              {shown.length === 0 && folders.data && (
                <p className="px-3 py-6 text-center text-[13px] text-ink-muted">
                  {t(d.move.noMatch)}
                </p>
              )}
              {shown.map((folder) => {
                const blocked = forbidden.has(folder.id) || folder.id === currentFolderId
                return (
                  <button
                    key={folder.id}
                    disabled={blocked}
                    onClick={() => {
                      setChosen(folder.id)
                      setError(null)
                    }}
                    style={{ paddingLeft: needle.length > 0 ? 12 : 12 + folder.depth * 16 }}
                    className={cn(
                      'flex w-full items-center gap-2 py-2 pr-3 text-left text-sm',
                      blocked ? 'text-ink-faint' : 'hover:bg-sunken',
                      chosen === folder.id && 'bg-primary-wash text-primary-active',
                    )}
                  >
                    <Folder className="size-4 shrink-0 text-secondary" />
                    <span className="truncate">{folder.name}</span>
                    {folder.id === currentFolderId && (
                      <span className="ml-auto text-xs text-ink-faint">{t(d.move.hereNow)}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}

            <DialogFooter className="mt-6">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                {t(d.common.cancel)}
              </Button>
              <Button
                variant="primary"
                disabled={chosen === null || busy}
                onClick={async () => {
                  if (!chosen) return
                  const into = folders.data?.find((folder) => folder.id === chosen)
                  setBusy(true)
                  setError(null)
                  try {
                    await onMove(row, chosen, into?.name ?? '')
                    onOpenChange(false)
                  } catch (problem) {
                    // Usually a name already taken in the destination, which is
                    // the reader's to fix: it belongs by the list, not in a
                    // toast that outlives the dialog.
                    setError(problem instanceof Error ? problem.message : t(d.common.didNotWork))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {t(d.move.move)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
