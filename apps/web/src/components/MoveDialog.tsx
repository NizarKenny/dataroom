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
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { Folder } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Props {
  row: Row | null
  roomId: string
  currentFolderId: string
  onOpenChange: (open: boolean) => void
  onMove: (row: Row, folderId: string) => Promise<void>
}

export function MoveDialog({ row, roomId, currentFolderId, onOpenChange, onMove }: Props) {
  const [chosen, setChosen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const folders = useQuery({
    queryKey: ['room-folders', roomId],
    queryFn: () => api.rooms.folders(roomId),
    enabled: row !== null,
  })

  useEffect(() => {
    if (row) setChosen(null)
  }, [row])

  // A folder cannot land inside itself, so its own subtree is not on offer.
  const forbidden = new Set<string>()
  if (row?.kind === 'folder' && folders.data) {
    forbidden.add(row.id)
    for (const folder of folders.data) {
      if (folder.parentId && forbidden.has(folder.parentId)) forbidden.add(folder.id)
    }
  }

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate">Move {row.name}</DialogTitle>
              <DialogDescription>Pick where it should go.</DialogDescription>
            </DialogHeader>

            <div className="mt-4 max-h-[280px] overflow-y-auto rounded-md border border-hairline">
              {folders.data?.map((folder) => {
                const blocked = forbidden.has(folder.id) || folder.id === currentFolderId
                return (
                  <button
                    key={folder.id}
                    disabled={blocked}
                    onClick={() => setChosen(folder.id)}
                    style={{ paddingLeft: 12 + folder.depth * 16 }}
                    className={cn(
                      'flex w-full items-center gap-2 py-2 pr-3 text-left text-sm',
                      blocked ? 'text-ink-faint' : 'hover:bg-sunken',
                      chosen === folder.id && 'bg-primary-wash text-primary-active',
                    )}
                  >
                    <Folder className="size-4 shrink-0 text-secondary" />
                    <span className="truncate">{folder.name}</span>
                    {folder.id === currentFolderId && (
                      <span className="ml-auto text-xs text-ink-faint">Here now</span>
                    )}
                  </button>
                )
              })}
            </div>

            <DialogFooter className="mt-6">
              <Button variant="utility" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={chosen === null || busy}
                onClick={async () => {
                  if (!chosen) return
                  setBusy(true)
                  try {
                    await onMove(row, chosen)
                    onOpenChange(false)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Move
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
