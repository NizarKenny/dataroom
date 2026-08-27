import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { SearchHit, SearchResults as Results } from '@/lib/api'
import { formatBytes, formatWhen } from '@/lib/format'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { ChevronRight, FileText } from 'lucide-react'
import { Fragment } from 'react'

interface Props {
  query: string
  results: Results | undefined
  pending: boolean
  onOpen: (hit: SearchHit) => void
  /** Left out where there is nowhere to go, which is a link holding one file. */
  onGoToFolder?: (hit: SearchHit) => void
}

/**
 * A flat list, because search results are not a folder. Each one carries where it
 * sits: in a numbered index three documents can share a name, and the folder is
 * the only thing that tells them apart.
 */
export function SearchResults({ query, results, pending, onOpen, onGoToFolder }: Props) {
  const t = useT()
  if (pending && !results) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }

  if (!results || results.files.length === 0) {
    return (
      <div className="px-6 py-13 text-center">
        <h2 className="text-xl font-semibold">{t(d.search.nothing(query))}</h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-ink-muted">{t(d.search.nothingLede)}</p>
      </div>
    )
  }

  return (
    <>
      {results.files.map((hit) => (
        <div
          key={hit.id}
          className="group flex items-center border-b border-hairline last:border-b-0 hover:bg-sunken"
        >
          <button
            onClick={() => onOpen(hit)}
            className="flex min-w-0 flex-1 items-center gap-3 px-4 py-[11px] text-left"
          >
            <FileText className="size-4 shrink-0 text-ink-faint" />
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
              {formatBytes(hit.sizeBytes)}
            </span>
            <span className="hidden w-24 text-right text-[13px] whitespace-nowrap text-ink-faint md:block">
              {formatWhen(hit.updatedAt)}
            </span>
          </button>

          <div className="w-28 pr-3">
            {onGoToFolder && (
              <Button
                variant="utility"
                size="sm"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => onGoToFolder(hit)}
              >
                {t(d.search.goToFolder)}
              </Button>
            )}
          </div>
        </div>
      ))}

      {results.truncated && (
        <p className="border-t border-hairline px-4 py-3 text-[13px] text-ink-faint">
          {t(d.search.truncated(results.files.length))}
        </p>
      )}
    </>
  )
}
