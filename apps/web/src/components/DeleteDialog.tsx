import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Row } from '@/components/FileTable'
import { api } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import { useQuery } from '@tanstack/react-query'

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
  const manifest = useQuery({
    queryKey: ['manifest', row?.id],
    queryFn: () => api.folders.manifest(row!.id),
    enabled: row?.kind === 'folder',
  })

  if (!row) return null

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Delete ${row.name}?`}
      description={
        row.kind === 'file'
          ? 'The file and any link to it stop working. This cannot be undone.'
          : 'Everything inside goes with it, and any link into it stops working. This cannot be undone.'
      }
      manifest={
        row.kind === 'folder' && manifest.data
          ? [
              { label: 'Folders', value: manifest.data.folders },
              { label: 'Files', value: manifest.data.files },
              { label: 'Size', value: formatBytes(manifest.data.bytes) },
              { label: 'Shares that stop working', value: manifest.data.shares },
            ]
          : undefined
      }
      confirmLabel="Delete"
      onConfirm={() => onConfirm(row)}
    />
  )
}
