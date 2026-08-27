import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Row } from '@/components/FileTable'
import { api } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
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
  const t = useT()
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
      title={t(d.del.title(row.name))}
      description={row.kind === 'file' ? t(d.del.fileLede) : t(d.del.folderLede)}
      manifest={
        row.kind === 'folder' && manifest.data
          ? [
              { label: t(d.common.folders), value: manifest.data.folders },
              { label: t(d.common.files), value: manifest.data.files },
              { label: t(d.common.size), value: formatBytes(manifest.data.bytes) },
              { label: t(d.del.sharesThatStop), value: manifest.data.shares },
            ]
          : undefined
      }
      confirmLabel={
        row.kind === 'folder' && manifest.data
          ? t(d.del.deleteItems(manifest.data.folders + manifest.data.files + 1))
          : t(d.common.delete)
      }
      onConfirm={() => onConfirm(row)}
    />
  )
}
