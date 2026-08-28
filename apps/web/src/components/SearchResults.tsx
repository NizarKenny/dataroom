import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { SearchResults as Results } from '@/lib/api'
import { d } from '@/lib/dictionary'
import { formatBytes, formatWhen } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { ChevronRight, FileText, Folder } from 'lucide-react'
import { Fragment } from 'react'

/** A result is a place to go or a thing to open, and it has to say which. */
type Hit = {
  id: string
  name: string
  kind: 'folder' | 'file'
  updatedAt: string
  sizeBytes: number | null
  trail: { id: string; name: string }[]
}

interface Props {
  query: string
  results: Results | undefined
  pending: boolean
  onOpenFile: (id: string) => void
  onOpenFolder: (id: string) => void
}

/**
 * A flat list, because search results are not a folder. Each carries where it
 * sits: in a numbered index three documents can share a name, and the folder is
 * the only thing telling them apart.
 */
export function SearchResults({ query, results, pending, onOpenFile, onOpenFolder }: Props) {
  const t = useT()

  if (pending && !results) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }

  // Folders first, the way a listing has them: a place to go before a thing to open.
  const hits: Hit[] = [
    ...(results?.folders ?? []).map((folder) => ({
      ...folder,
      kind: 'folder' as const,
      sizeBytes: null,
    })),
    ...(results?.files ?? []).map((file) => ({ ...file, kind: 'file' as const })),
  ]

  if (hits.length === 0) {
    return (
      <div className="px-6 py-13 text-center">
        <h2 className="text-xl font-semibold">{t(d.search.nothing(query))}</h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-ink-muted">{t(d.search.nothingLede)}</p>
      </div>
    )
  }

  return (
    <>
      {hits.map((hit) => (
        <div key={hit.id} className="group row-rule flex items-center last:bg-none hover:bg-sunken">
          <button
            onClick={() => (hit.kind === 'folder' ? onOpenFolder(hit.id) : onOpenFile(hit.id))}
            className="flex min-w-0 flex-1 items-center gap-3 px-4 py-[11px] text-left"
          >
            {hit.kind === 'folder' ? (
              <Folder className="size-4 shrink-0 text-secondary" />
            ) : (
              <FileText className="size-4 shrink-0 text-ink-faint" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{hit.name}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-faint">
                {hit.trail.map((crumb, index) => (
                  <Fragment key={crumb.id}>
                    {index > 0 && <ChevronRight className="size-3" />}
                    <span className="truncate">{crumb.name}</span>
                  </Fragment>
                ))}
              </span>
            </span>
            <span className="tabular hidden text-[13px] whitespace-nowrap text-ink-muted sm:block">
              {hit.sizeBytes === null ? '' : formatBytes(hit.sizeBytes)}
            </span>
            <span className="hidden w-24 text-right text-[13px] whitespace-nowrap text-ink-faint md:block">
              {formatWhen(hit.updatedAt)}
            </span>
          </button>

          <div className="w-28 pr-3">
            {/* A folder result is already the place; only a file needs a way to it. */}
            {hit.kind === 'file' && 'folderId' in hit && (
              <Button
                variant="utility"
                size="sm"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => onOpenFolder((hit as { folderId: string }).folderId)}
              >
                {t(d.search.goToFolder)}
              </Button>
            )}
          </div>
        </div>
      ))}

      {results?.truncated && (
        <p className="border-t border-hairline px-4 py-3 text-[13px] text-ink-faint">
          {t(d.search.truncated(hits.length))}
        </p>
      )}
    </>
  )
}
