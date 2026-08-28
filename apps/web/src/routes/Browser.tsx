import { AccessBanner } from '@/components/AccessBanner'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { DeleteDialog } from '@/components/DeleteDialog'
import { FilePreview } from '@/components/FilePreview'
import { FileTable, type Row } from '@/components/FileTable'
import { MoveDialog } from '@/components/MoveDialog'
import { PromptDialog } from '@/components/PromptDialog'
import { LockButton } from '@/components/LockButton'
import { ModifiedFilter } from '@/components/ModifiedFilter'
import { Pager } from '@/components/Pager'
import { ReaderBanner } from '@/components/ReaderBanner'
import { SearchField } from '@/components/SearchField'
import { SearchResults } from '@/components/SearchResults'
import { ShareDialog, type ShareTarget } from '@/components/ShareDialog'
import { TopBar } from '@/components/TopBar'
import { UpButton } from '@/components/UpButton'
import { VersionsDialog } from '@/components/VersionsDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError, type Modified } from '@/lib/api'
import { DEFAULT_SORT, isDefaultSort, nextSort, type Sort, type SortBy } from '@/lib/sort'
import { useDebounced } from '@/lib/useDebounced'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { useUploads } from '@/uploads/queue'
import { UploadPanel } from '@/uploads/UploadPanel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderPlus, Share2, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

export function Browser() {
  const t = useT()
  const { folderId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // The page and the filter live in the URL: a listing somebody links to opens
  // where they were looking, and walking into another folder drops both, because
  // navigate() leaves the query behind.
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const modified = (params.get('modified') ?? 'any') as Modified
  const sort: Sort = {
    by: (params.get('sort') ?? DEFAULT_SORT.by) as SortBy,
    dir: params.get('dir') === 'desc' ? 'desc' : 'asc',
  }

  const view = useQuery({
    queryKey: ['folder', folderId, page, modified, sort.by, sort.dir],
    queryFn: () => api.folders.get(folderId, page, modified, sort),
    placeholderData: (previous) => previous,
  })

  function setQueryParam(key: string, value: string, fallback: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value === fallback) next.delete(key)
        else next.set(key, value)
        // A narrower or reordered list has fewer pages, or different ones,
        // and page seven of four is nothing.
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  // Searching asks about the whole room, so it lives beside the folder query
  // rather than inside it, and survives walking from one folder to another.
  const [query, setQuery] = useState('')
  const term = useDebounced(query.trim(), 250)
  const roomId = view.data?.room.id

  const results = useQuery({
    queryKey: ['search', roomId, term],
    queryFn: () => api.rooms.search(roomId!, term),
    enabled: Boolean(roomId) && term.length > 0,
    // Holds the last answer while the next one loads, so the list does not blink
    // back to empty on every keystroke.
    placeholderData: (previous) => previous,
  })

  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [moving, setMoving] = useState<Row | null>(null)
  const [sharing, setSharing] = useState<ShareTarget | null>(null)
  const [previewing, setPreviewing] = useState<Row | null>(null)
  const [history, setHistory] = useState<Row | null>(null)
  const [dragging, setDragging] = useState(false)

  const picker = useRef<HTMLInputElement>(null)

  function refresh(which = folderId) {
    void queryClient.invalidateQueries({ queryKey: ['folder', which] })
    void queryClient.invalidateQueries({ queryKey: ['rooms'] })
  }

  // A file that lands after the reader has walked on refreshes the folder it
  // actually went into, not the one they are looking at now.
  const uploads = useUploads(folderId, (into) => refresh(into))

  const createFolder = useMutation({
    mutationFn: (name: string) => api.folders.create(folderId, name),
    onSuccess: () => refresh(),
  })

  const rename = useMutation({
    mutationFn: ({ row, name }: { row: Row; name: string }) =>
      row.kind === 'folder'
        ? api.folders.update(row.id, { name })
        : api.files.update(row.id, { name }),
    onSuccess: () => refresh(),
  })

  const move = useMutation({
    mutationFn: ({ row, into }: { row: Row; into: string; intoName: string }) =>
      row.kind === 'folder'
        ? api.folders.update(row.id, { parentId: into })
        : api.files.update(row.id, { folderId: into }),
    onSuccess: (_result, { intoName }) => {
      refresh()
      void queryClient.invalidateQueries({ queryKey: ['room-folders'] })
      toast.success(t(d.browser.movedInto(intoName)))
    },
  })

  const remove = useMutation({
    mutationFn: (row: Row) =>
      row.kind === 'folder' ? api.folders.remove(row.id) : api.files.remove(row.id),
    onSuccess: (_result, row) => {
      refresh()
      void queryClient.invalidateQueries({ queryKey: ['room-folders'] })
      toast.success(t(d.browser.deleted(row.name)))
    },
  })

  if (view.isPending) return <Loading />

  if (view.isError) {
    // 400 comes back when the id in the address is not even shaped like one,
    // which is a typed or truncated URL. To the reader that is the same news as
    // a 404, and "try again in a moment" would be a lie about both.
    const missing =
      view.error instanceof ApiError && (view.error.status === 404 || view.error.status === 400)
    return (
      <Shell>
        <div className="rounded-lg border border-hairline bg-surface px-6 py-13 text-center">
          <h2 className="text-xl font-semibold">
            {t(missing ? d.browser.notHere : d.common.wentWrong)}
          </h2>
          <p className="mx-auto mt-2 mb-4 max-w-[42ch] text-ink-muted">
            {t(missing ? d.browser.notHereLede : d.browser.loadFailed)}
          </p>
          <Button variant="secondary" onClick={() => navigate('/')}>
            {t(d.browser.backToRooms)}
          </Button>
        </div>
      </Shell>
    )
  }

  const { room, folder, breadcrumbs, folders, files } = view.data
  const owner = room.role === 'owner'
  const atRoot = folder.parentId === null && breadcrumbs.length === 1

  // A reader's trail is clipped at their grant, so the crumb before this one is
  // always somewhere they are allowed to be. Above it there is only the list of
  // rooms, which is where an owner at the top of a room goes.
  const parent = breadcrumbs[breadcrumbs.length - 2] ?? null
  const searching = query.trim().length > 0
  const filtered = modified !== 'any'

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

  const rows: Row[] = [
    ...folders.map((entry) => ({ kind: 'folder' as const, ...entry })),
    ...files.map((entry) => ({ kind: 'file' as const, ...entry })),
  ]

  function open(row: Row) {
    if (row.kind === 'folder') navigate(`/f/${row.id}`)
    else setPreviewing(row)
  }

  async function download(row: Row) {
    const link = await api.files.download(row.id, 'attachment')
    window.location.href = link.url
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (!owner) return
    const dropped = Array.from(event.dataTransfer.files)
    if (dropped.length > 0) uploads.add(dropped)
  }

  return (
    <Shell name={room.name}>
      <div
        onDragOver={(event) => {
          if (!owner) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={
          dragging
            ? 'rounded-lg outline-2 outline-offset-4 outline-primary'
            : 'rounded-lg outline-2 outline-offset-4 outline-transparent'
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <UpButton
            to={parent?.name ?? t(d.browser.theDataRooms)}
            onClick={() => navigate(parent ? `/f/${parent.id}` : '/')}
          />
          <h1 className="min-w-0 flex-1 truncate text-[26px] leading-[1.23] font-bold tracking-[-0.625px]">
            {folder.name}
          </h1>

          {/* Full width below the small breakpoint, which drops the pair onto a
              line of their own and leaves the folder name a line to be read on. */}
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <SearchField value={query} onChange={setQuery} placeholder={t(d.browser.search)} />

            {/* Results are room wide and already sorted by name, so a window on
                the modified date would be filtering something else. */}
            {!searching && (
              <ModifiedFilter
                value={modified}
                onChange={(next) => setQueryParam('modified', next, 'any')}
              />
            )}
          </div>

          {/* Measured: the three labelled buttons want 357px and a 390px phone has
              358 to give them. Below the small breakpoint they are their icons,
              which is the difference between a toolbar and a second line of one. */}
          {owner && (
            <>
              <Button
                variant="utility"
                aria-label={t(d.browser.newFolder)}
                onClick={() => setCreating(true)}
              >
                <FolderPlus />
                <span className="hidden sm:inline">{t(d.browser.newFolder)}</span>
              </Button>
              <Button
                variant="secondary"
                aria-label={t(d.browser.uploadFiles)}
                onClick={() => picker.current?.click()}
              >
                <Upload />
                <span className="hidden sm:inline">{t(d.browser.upload)}</span>
              </Button>
              <Button
                variant="primary"
                aria-label={t(d.common.share)}
                onClick={() =>
                  setSharing(
                    atRoot
                      ? { type: 'data_room', id: room.id, name: room.name }
                      : { type: 'folder', id: folder.id, name: folder.name },
                  )
                }
              >
                <Share2 />
                <span className="hidden sm:inline">{t(d.common.share)}</span>
              </Button>
            </>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
          {/* Results are room wide, so the trail and the banners for the folder
              behind them would be describing something the reader is not looking
              at. They come back the moment the field is cleared. */}
          {searching ? (
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
                navigate(`/f/${id}`)
              }}
            />
          ) : (
            <>
              {/* The trail used to be hidden at the top of a room, where it
                  only repeated the heading. It stays now: the row is where the
                  lock over the columns lives, and a row holding one control and
                  nothing else reads as something that failed to load. */}
              <Breadcrumbs
                trail={breadcrumbs}
                onNavigate={(id) => navigate(`/f/${id}`)}
                granted={!owner}
              >
                <LockButton />
              </Breadcrumbs>

              {!owner && breadcrumbs[0] && (
                <ReaderBanner grantedAt={breadcrumbs[0].name} through="invitation" />
              )}

              {folder.access && (
                <AccessBanner
                  access={folder.access}
                  grantedAtName={
                    breadcrumbs.find((crumb) => crumb.id === folder.access?.grantedAt)?.name ?? null
                  }
                  onManage={() =>
                    setSharing(
                      atRoot
                        ? { type: 'data_room', id: room.id, name: room.name }
                        : { type: 'folder', id: folder.id, name: folder.name },
                    )
                  }
                />
              )}

              {rows.length === 0 && filtered ? (
                // An empty folder and a folder hidden by a filter look identical,
                // and only one of them is the reader's own doing.
                <div className="px-6 py-13 text-center">
                  <h2 className="text-xl font-semibold">{t(d.browser.filteredEmpty)}</h2>
                  <p className="mx-auto mt-2 mb-4 max-w-[42ch] text-ink-muted">
                    This folder has {view.data.page.total === 0 ? 'things' : 'more'} in it, outside
                    the window you picked.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => setQueryParam('modified', 'any', 'any')}
                  >
                    {t(d.browser.showEverything)}
                  </Button>
                </div>
              ) : rows.length === 0 ? (
                <div className="px-6 py-13 text-center">
                  <h2 className="text-xl font-semibold">
                    {t(owner ? d.browser.emptyOwner : d.browser.emptyReader)}
                  </h2>
                  <p className="mx-auto mt-2 mb-4 max-w-[42ch] text-ink-muted">
                    {t(owner ? d.browser.emptyOwnerLede : d.browser.emptyReaderLede)}
                  </p>
                  {owner && (
                    <Button variant="primary" onClick={() => picker.current?.click()}>
                      {t(d.browser.uploadFiles)}
                    </Button>
                  )}
                </div>
              ) : (
                <FileTable
                  rows={rows}
                  onOpen={open}
                  sort={sort}
                  onSort={reorder}
                  actions={
                    owner
                      ? {
                          rename: setRenaming,
                          move: setMoving,
                          remove: setDeleting,
                          download,
                          history: setHistory,
                          share: (row) =>
                            setSharing({
                              type: row.kind === 'folder' ? 'folder' : 'file',
                              id: row.id,
                              name: row.name,
                            }),
                        }
                      : undefined
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
        </div>
      </div>

      <input
        ref={picker}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const chosen = Array.from(event.target.files ?? [])
          if (chosen.length > 0) uploads.add(chosen)
          event.target.value = ''
        }}
      />

      <PromptDialog
        open={creating}
        onOpenChange={setCreating}
        title={t(d.browser.newFolderTitle)}
        label={t(d.common.name)}
        submitLabel={t(d.common.create)}
        onSubmit={async (name) => {
          await createFolder.mutateAsync(name)
        }}
      />

      <PromptDialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
        title={t(d.browser.renameTitle(renaming?.name ?? ''))}
        label={t(d.common.name)}
        submitLabel={t(d.common.rename)}
        initialValue={renaming?.name}
        onSubmit={async (name) => {
          if (renaming) await rename.mutateAsync({ row: renaming, name })
        }}
      />

      <MoveDialog
        row={moving}
        roomId={room.id}
        currentFolderId={folder.id}
        onOpenChange={(open) => !open && setMoving(null)}
        onMove={async (row, into, intoName) => {
          await move.mutateAsync({ row, into, intoName })
        }}
      />

      <DeleteDialog
        row={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={async (row) => {
          await remove.mutateAsync(row)
        }}
      />

      <ShareDialog
        target={sharing}
        onOpenChange={(open) => !open && setSharing(null)}
        onChanged={refresh}
      />

      <FilePreview
        file={previewing?.kind === 'file' ? previewing : null}
        onOpenChange={(open) => !open && setPreviewing(null)}
        getLink={(id, disposition) => api.files.download(id, disposition)}
        scope="account"
      />

      <VersionsDialog
        file={history?.kind === 'file' ? history : null}
        onOpenChange={(open) => !open && setHistory(null)}
        onRestored={() => refresh()}
      />

      <UploadPanel queue={uploads} />
    </Shell>
  )
}

function Shell({ name, children }: { name?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <TopBar>{name && <span className="truncate text-[13px] text-ink-muted">{name}</span>}</TopBar>
      <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}

function Loading() {
  return (
    <Shell>
      <Skeleton className="mb-4 h-7 w-56" />
      <div className="space-y-3 rounded-lg border border-hairline bg-surface p-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>
    </Shell>
  )
}
