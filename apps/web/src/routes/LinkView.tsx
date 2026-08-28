import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { LockButton } from '@/components/LockButton'
import { ModifiedFilter } from '@/components/ModifiedFilter'
import { Pager } from '@/components/Pager'
import { SearchField } from '@/components/SearchField'
import { SearchResults } from '@/components/SearchResults'
import { UpButton } from '@/components/UpButton'
import { FilePreview } from '@/components/FilePreview'
import { FileTable, type Row } from '@/components/FileTable'
import { ReaderBanner } from '@/components/ReaderBanner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError, type Modified } from '@/lib/api'
import { DEFAULT_SORT, isDefaultSort, nextSort, type Sort, type SortBy } from '@/lib/sort'
import { useDebounced } from '@/lib/useDebounced'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { formatBytes } from '@/lib/format'
import { useTheme } from '@/theme'
import { useQuery } from '@tanstack/react-query'
import { Download, Link2, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

/**
 * What the holder of a public link sees. No account, no toolbar, and no access
 * column: the reader is being shown documents, not the room's guest list.
 */
export function LinkView() {
  const t = useT()
  const { token = '', folderId } = useParams()
  const navigate = useNavigate()
  const [previewing, setPreviewing] = useState<Row | null>(null)
  const [query, setQuery] = useState('')
  const term = useDebounced(query.trim(), 250)

  const opened = useQuery({
    queryKey: ['link', token],
    queryFn: () => api.links.open(token),
    retry: false,
  })

  const shownFolder = folderId ?? opened.data?.folderId ?? null

  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const modified = (params.get('modified') ?? 'any') as Modified
  const sort: Sort = {
    by: (params.get('sort') ?? DEFAULT_SORT.by) as SortBy,
    dir: params.get('dir') === 'desc' ? 'desc' : 'asc',
  }

  const view = useQuery({
    queryKey: ['link-folder', token, shownFolder, page, modified, sort.by, sort.dir],
    queryFn: () => api.links.folder(token, shownFolder!, page, modified, sort),
    enabled: shownFolder !== null,
    placeholderData: (previous) => previous,
  })

  function setQueryParam(key: string, value: string, fallback: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value === fallback) next.delete(key)
        else next.set(key, value)
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  // Someone sent two hundred documents through one link needs to find one of
  // them, and the scope on the server keeps it inside what the link reaches.
  const results = useQuery({
    queryKey: ['link-search', token, term],
    queryFn: () => api.links.search(token, term),
    enabled: term.length > 0,
    placeholderData: (previous) => previous,
  })
  const searching = query.trim().length > 0

  function reorder(by: SortBy) {
    const next = nextSort(sort, by)
    setParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        params.delete('page')
        if (isDefaultSort(next)) {
          params.delete('sort')
          params.delete('dir')
        } else {
          params.set('sort', next.by)
          params.set('dir', next.dir)
        }
        return params
      },
      { replace: true },
    )
  }

  if (opened.isPending) {
    return (
      <Shell>
        <div className="space-y-3 rounded-lg border border-hairline bg-surface p-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
      </Shell>
    )
  }

  if (opened.isError) {
    // Three different things, and telling someone to check the address they were
    // sent when the server is the one having trouble sends them nowhere useful.
    const problem = opened.error instanceof ApiError ? opened.error : null
    const [heading, detail] =
      problem?.code === 'share_revoked'
        ? [t(d.link.revoked), t(d.link.revokedLede)]
        : problem?.status === 404
          ? [t(d.link.invalid), t(d.link.invalidLede)]
          : [t(d.link.failed), t(d.link.failedLede)]

    return (
      <Shell shared={false}>
        <div className="rounded-lg border border-hairline bg-surface px-6 py-13 text-center">
          <h2 className="text-xl font-semibold">{heading}</h2>
          <p className="mx-auto mt-2 max-w-[42ch] text-ink-muted">{detail}</p>
        </div>
      </Shell>
    )
  }

  const link = opened.data

  if (link.kind === 'file' && link.file) {
    const file = link.file
    return (
      <Shell room={link.room.name}>
        <div className="rounded-lg border border-hairline bg-surface p-6">
          <h1 className="truncate text-[26px] leading-[1.23] font-bold tracking-[-0.625px]">
            {file.name}
          </h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            {formatBytes(file.sizeBytes)} · {file.mimeType}
          </p>

          <div className="mt-4 flex gap-2">
            <Button
              variant="primary"
              onClick={() => setPreviewing({ kind: 'file', ...file, updatedAt: '', access: null })}
            >
              Open
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                const saved = await api.links.download(token, file.id, 'attachment')
                window.location.href = saved.url
              }}
            >
              <Download />
              Download
            </Button>
          </div>
        </div>

        <FilePreview
          file={previewing?.kind === 'file' ? previewing : null}
          onOpenChange={(open) => !open && setPreviewing(null)}
          getLink={(id, disposition) => api.links.download(token, id, disposition)}
          scope={token}
        />
      </Shell>
    )
  }

  const trail = view.data?.breadcrumbs ?? []
  const parent = trail[trail.length - 2] ?? null

  return (
    <Shell room={link.room.name}>
      {view.data && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Only inside the shared folder. At its top there is nowhere a link
              holder is allowed to go, so there is no button offering it. */}
          {parent && (
            <UpButton to={parent.name} onClick={() => navigate(`/l/${token}/f/${parent.id}`)} />
          )}
          <h1 className="min-w-0 flex-1 truncate text-[26px] leading-[1.23] font-bold tracking-[-0.625px]">
            {view.data.folder.name}
          </h1>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={t(d.browser.searchShared)}
            />

            {!searching && (
              <ModifiedFilter
                value={modified}
                onChange={(next) => setQueryParam('modified', next, 'any')}
              />
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
        {searching && (
          <SearchResults
            query={term}
            results={results.data}
            pending={results.isPending || term !== query.trim()}
            onOpenFile={(id) => {
              const hit = results.data?.files.find((file) => file.id === id)
              if (hit) setPreviewing({ kind: 'file', ...hit })
            }}
            onOpenFolder={(id) => {
              setQuery('')
              navigate(`/l/${token}/f/${id}`)
            }}
          />
        )}

        {!searching && view.data && (
          <>
            {view.data.breadcrumbs[0] && (
              <ReaderBanner grantedAt={view.data.breadcrumbs[0].name} through="link" />
            )}

            <Breadcrumbs
              trail={view.data.breadcrumbs}
              onNavigate={(id) => navigate(`/l/${token}/f/${id}`)}
              granted
            >
              <LockButton />
            </Breadcrumbs>

            {view.data.folders.length + view.data.files.length === 0 ? (
              <div className="px-6 py-13 text-center">
                <h2 className="text-xl font-semibold">{t(d.browser.emptyReader)}</h2>
                <p className="mx-auto mt-2 max-w-[42ch] text-ink-muted">
                  {t(d.browser.emptyReaderLede)}
                </p>
              </div>
            ) : (
              <FileTable
                sort={sort}
                onSort={reorder}
                rows={[
                  ...view.data.folders.map((entry) => ({ kind: 'folder' as const, ...entry })),
                  ...view.data.files.map((entry) => ({ kind: 'file' as const, ...entry })),
                ]}
                onOpen={(row) =>
                  row.kind === 'folder' ? navigate(`/l/${token}/f/${row.id}`) : setPreviewing(row)
                }
              />
            )}

            <Pager
              page={view.data.page.number}
              pages={view.data.page.pages}
              onGoTo={(next) => setQueryParam('page', String(next), '1')}
            />
          </>
        )}

        {view.isPending && <Skeleton className="m-4 h-24" />}

        {view.isError && (
          <p className="px-6 py-13 text-center text-ink-muted">{t(d.link.folderFailed)}</p>
        )}
      </div>

      <FilePreview
        file={previewing?.kind === 'file' ? previewing : null}
        onOpenChange={(open) => !open && setPreviewing(null)}
        getLink={(id, disposition) => api.links.download(token, id, disposition)}
        scope={token}
      />
    </Shell>
  )
}

function Shell({
  room,
  shared = true,
  children,
}: {
  room?: string
  shared?: boolean
  children: React.ReactNode
}) {
  const t = useT()
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-4 sm:px-6">
          <span className="shrink-0 font-semibold tracking-[-0.02em] whitespace-nowrap">
            Data Room
          </span>
          {room && <span className="min-w-0 truncate text-[13px] text-ink-muted">{room}</span>}

          {shared && (
            <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-primary-wash px-2.5 py-[3px] text-xs font-semibold whitespace-nowrap text-primary-active">
              <Link2 className="size-3.5" />
              Shared with you
            </span>
          )}

          <Button
            variant="utility"
            size="icon"
            onClick={toggle}
            aria-label={t(theme === 'dark' ? d.theme.toLight : d.theme.toDark)}
            className={shared ? undefined : 'ml-auto'}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>

          <LanguageSwitch />
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
