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
import { formatBytes } from '@/lib/format'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

interface Props {
  row: Row | null
  onOpenChange: (open: boolean) => void
  onConfirm: (row: Row) => Promise<void>
}

/**
 * A folder in a data room is rarely as small as it looks, and deleting one takes
 * the subtree and every share pointing into it. So the dialog counts first and
 * asks second.
 */
export function DeleteDialog({ row, onOpenChange, onConfirm }: Props) {
  const [busy, setBusy] = useState(false)

  const manifest = useQuery({
    queryKey: ['manifest', row?.id],
    queryFn: () => api.folders.manifest(row!.id),
    enabled: row?.kind === 'folder',
  })

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle>Delete {row.name}?</DialogTitle>
              <DialogDescription>
                {row.kind === 'file'
                  ? 'The file and any link to it stop working. This cannot be undone.'
                  : 'Everything inside goes with it, and any link into it stops working. This cannot be undone.'}
              </DialogDescription>
            </DialogHeader>

            {row.kind === 'folder' && manifest.data && (
              <div className="mt-4 rounded-md bg-sunken px-4 py-3">
                <Line label="Folders" value={manifest.data.folders} />
                <Line label="Files" value={manifest.data.files} />
                <Line label="Size" value={formatBytes(manifest.data.bytes)} />
                <Line label="Shares that stop working" value={manifest.data.shares} />
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button variant="utility" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await onConfirm(row)
                    onOpenChange(false)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Line({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-[3px] text-[13px] text-ink-secondary">
      <span>{label}</span>
      <span className="tabular font-mono">{value}</span>
    </div>
  )
}
