import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatBytes, formatWhen } from '@/lib/format'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  file: { id: string; name: string } | null
  onOpenChange: (open: boolean) => void
  onRestored: () => void
}

/**
 * Every set of bytes this document has been. Newest first, because the question
 * is almost always "what changed", and only occasionally "what was it in March".
 */
export function VersionsDialog({ file, onOpenChange, onRestored }: Props) {
  const t = useT()
  const queryClient = useQueryClient()

  const versions = useQuery({
    queryKey: ['versions', file?.id],
    queryFn: () => api.files.versions(file!.id),
    enabled: file !== null,
  })

  const restore = useMutation({
    mutationFn: (version: number) => api.files.restore(file!.id, version),
    onSuccess: (_, version) => {
      void queryClient.invalidateQueries({ queryKey: ['versions', file?.id] })
      onRestored()
      toast.success(t(d.versions.restored(version)))
    },
    onError: (problem: Error) => toast.error(problem.message),
  })

  async function open(version: number) {
    const link = await api.files.versionDownload(file!.id, version, 'inline')
    window.open(link.url, '_blank', 'noopener')
  }

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(560px,92vw)] sm:max-w-[min(560px,92vw)]">
        {file && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{t(d.versions.title(file.name))}</DialogTitle>
              <DialogDescription>{t(d.versions.lede)}</DialogDescription>
            </DialogHeader>

            {versions.isPending && <Skeleton className="h-24 w-full" />}

            <ul className="divide-y divide-hairline">
              {versions.data?.map((entry) => (
                <li key={entry.version} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {t(d.versions.version(entry.version))}
                      {entry.current && (
                        <span className="ml-2 rounded-full bg-secondary-wash px-2 py-[2px] text-xs font-semibold text-secondary">
                          {t(d.versions.current)}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-muted">
                      {formatBytes(entry.sizeBytes)} · {formatWhen(entry.createdAt)} ·{' '}
                      {entry.createdBy}
                    </p>
                  </div>

                  <Button
                    variant="utility"
                    size="icon"
                    aria-label={t(d.versions.open(entry.version))}
                    onClick={() => void open(entry.version)}
                  >
                    <Download />
                  </Button>

                  {!entry.current && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={restore.isPending}
                      onClick={() => restore.mutate(entry.version)}
                    >
                      {t(d.versions.makeCurrent)}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
