import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { DownloadLink } from '@/lib/api'
import { d } from '@/lib/dictionary'
import { describeType, formatBytes } from '@/lib/format'
import { useT, type Phrase } from '@/lib/i18n'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'

interface Props {
  file: { id: string; name: string; sizeBytes: number; mimeType: string } | null
  onOpenChange: (open: boolean) => void
  /** Signed differently for a link holder than for a signed-in reader. */
  getLink: (id: string, disposition: 'inline' | 'attachment') => Promise<DownloadLink>
  /** Who is asking, so one reader's signed URL is not served to the other. */
  scope: string
}

export function FilePreview({ file, onOpenChange, getLink, scope }: Props) {
  const t = useT()
  const link = useQuery({
    queryKey: ['preview', scope, file?.id],
    queryFn: () => getLink(file!.id, 'inline'),
    enabled: file !== null,
  })

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[86dvh] max-w-[min(920px,92vw)] flex-col sm:max-w-[min(920px,92vw)]">
        {file && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{file.name}</DialogTitle>
              <DialogDescription>
                {formatBytes(file.sizeBytes)} · {t(describeType(file.mimeType))}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-hairline bg-sunken">
              {link.isPending && <Skeleton className="size-full" />}
              {link.data && <Preview url={link.data.url} type={file.mimeType} name={file.name} />}
            </div>

            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={async () => {
                  const saved = await getLink(file.id, 'attachment')
                  window.location.href = saved.url
                }}
              >
                <Download />
                {t(d.common.download)}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Preview({ url, type, name }: { url: string; type: string; name: string }) {
  if (type === 'application/pdf') {
    // The sidebar goes, the toolbar stays: a reader in a data room needs to page
    // through a hundred page agreement and search inside it, and that is worth
    // more than hiding the storage key the browser puts in its title bar.
    return <iframe src={`${url}#navpanes=0`} title={name} className="size-full border-0" />
  }

  if (type.startsWith('image/')) {
    return (
      <div className="grid size-full place-items-center p-4">
        <img src={url} alt={name} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }

  if (type.startsWith('text/')) return <TextPreview url={url} />

  // Anything the browser cannot render honestly says so rather than showing an
  // empty frame and letting the reader wonder whether the file is broken.
  return <Unrenderable phrase={d.preview.none} />
}

/**
 * Text is fetched and printed rather than framed. A browser hands text/plain to
 * an iframe and downloads text/csv, so the frame that worked for a note came up
 * blank for a spreadsheet export, which is most of the text in a data room.
 */
function TextPreview({ url }: { url: string }) {
  const text = useQuery({
    queryKey: ['preview-text', url],
    queryFn: async () => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(String(response.status))
      return response.text()
    },
    retry: false,
  })

  if (text.isPending) return <Skeleton className="size-full" />
  if (text.isError) return <Unrenderable phrase={d.preview.unreadable} />

  return (
    <pre className="size-full overflow-auto bg-surface p-4 font-mono text-[13px] leading-[1.6] whitespace-pre">
      {text.data}
    </pre>
  )
}

function Unrenderable({ phrase }: { phrase: Phrase }) {
  const t = useT()
  return (
    <div className="grid size-full place-items-center p-6 text-center">
      <p className="max-w-[42ch] text-ink-muted">{t(phrase)}</p>
    </div>
  )
}
