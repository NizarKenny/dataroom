import { AccessBanner } from '@/components/AccessBanner'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { DeleteDialog } from '@/components/DeleteDialog'
import { FilePreview } from '@/components/FilePreview'
import { FileTable, type Row } from '@/components/FileTable'
import { MoveDialog } from '@/components/MoveDialog'
import { PromptDialog } from '@/components/PromptDialog'
import { ShareDialog, type ShareTarget } from '@/components/ShareDialog'
import { TopBar } from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError } from '@/lib/api'
import { useUploads } from '@/uploads/queue'
import { UploadPanel } from '@/uploads/UploadPanel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderPlus, Share2, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

export function Browser() {
  const { folderId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const view = useQuery({
    queryKey: ['folder', folderId],
    queryFn: () => api.folders.get(folderId),
  })

  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [moving, setMoving] = useState<Row | null>(null)
  const [sharing, setSharing] = useState<ShareTarget | null>(null)
  const [previewing, setPreviewing] = useState<Row | null>(null)
  const [dragging, setDragging] = useState(false)

  const picker = useRef<HTMLInputElement>(null)

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['folder', folderId] })
    void queryClient.invalidateQueries({ queryKey: ['rooms'] })
  }

  const uploads = useUploads(folderId, refresh)

  const createFolder = useMutation({
    mutationFn: (name: string) => api.folders.create(folderId, name),
    onSuccess: refresh,
  })

  const rename = useMutation({
    mutationFn: ({ row, name }: { row: Row; name: string }) =>
      row.kind === 'folder'
        ? api.folders.update(row.id, { name })
        : api.files.update(row.id, { name }),
    onSuccess: refresh,
  })

  const move = useMutation({
    mutationFn: ({ row, into }: { row: Row; into: string }) =>
      row.kind === 'folder'
        ? api.folders.update(row.id, { parentId: into })
        : api.files.update(row.id, { folderId: into }),
    onSuccess: () => {
      refresh()
      void queryClient.invalidateQueries({ queryKey: ['room-folders'] })
      toast.success('Moved')
    },
  })

  const remove = useMutation({
    mutationFn: (row: Row) =>
      row.kind === 'folder' ? api.folders.remove(row.id) : api.files.remove(row.id),
    onSuccess: (_result, row) => {
      refresh()
      void queryClient.invalidateQueries({ queryKey: ['room-folders'] })
      toast.success(`${row.name} deleted`)
    },
    onError: (problem) =>
      toast.error(problem instanceof Error ? problem.message : 'That could not be deleted'),
  })

  if (view.isPending) return <Loading />

  if (view.isError) {
    const missing = view.error instanceof ApiError && view.error.status === 404
    return (
      <Shell>
        <div className="rounded-lg border border-hairline bg-surface px-6 py-13 text-center">
          <h2 className="text-xl font-semibold">
            {missing ? 'This folder is not here' : 'Something went wrong'}
          </h2>
          <p className="mx-auto mt-2 mb-4 max-w-[42ch] text-ink-muted">
            {missing
              ? 'It may have been deleted, or your access to it may have been turned off.'
              : 'The folder could not be loaded. Try again in a moment.'}
          </p>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Back to the data rooms
          </Button>
        </div>
      </Shell>
    )
  }

  const { room, folder, breadcrumbs, folders, files } = view.data
  const owner = room.role === 'owner'
  const atRoot = folder.parentId === null && breadcrumbs.length === 1

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
        <div className="mb-4 flex items-center gap-3">
          <h1 className="flex-1 truncate text-[22px] font-semibold tracking-[-0.02em]">
            {folder.name}
          </h1>

          {owner && (
            <>
              <Button variant="utility" onClick={() => setCreating(true)}>
                <FolderPlus />
                New folder
              </Button>
              <Button variant="secondary" onClick={() => picker.current?.click()}>
                <Upload />
                Upload
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  setSharing(
                    atRoot
                      ? { type: 'data_room', id: room.id, name: room.name }
                      : { type: 'folder', id: folder.id, name: folder.name },
                  )
                }
              >
                <Share2 />
                Share
              </Button>
            </>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
          {/* At the top of a room the trail would only repeat the heading. */}
          {breadcrumbs.length > 1 && (
            <Breadcrumbs
              trail={breadcrumbs}
              onNavigate={(id) => navigate(`/f/${id}`)}
              granted={!owner}
            />
          )}

          {folder.access && (
            <AccessBanner
              access={folder.access}
              onManage={() =>
                setSharing(
                  atRoot
                    ? { type: 'data_room', id: room.id, name: room.name }
                    : { type: 'folder', id: folder.id, name: folder.name },
                )
              }
            />
          )}

          {rows.length === 0 ? (
            <div className="px-6 py-13 text-center">
              <h2 className="text-xl font-semibold">
                {owner ? 'Nothing in here yet' : 'This folder is empty'}
              </h2>
              <p className="mx-auto mt-2 mb-4 max-w-[42ch] text-ink-muted">
                {owner
                  ? 'Drop files anywhere on this page, or make a folder to sort them into.'
                  : 'Nothing has been put in here yet.'}
              </p>
              {owner && (
                <Button variant="primary" onClick={() => picker.current?.click()}>
                  Upload files
                </Button>
              )}
            </div>
          ) : (
            <FileTable
              rows={rows}
              onOpen={open}
              actions={
                owner
                  ? {
                      rename: setRenaming,
                      move: setMoving,
                      remove: setDeleting,
                      download,
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
        title="New folder"
        label="Name"
        submitLabel="Create"
        onSubmit={async (name) => {
          await createFolder.mutateAsync(name)
        }}
      />

      <PromptDialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
        title={`Rename ${renaming?.name ?? ''}`}
        label="Name"
        submitLabel="Rename"
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
        onMove={async (row, into) => {
          await move.mutateAsync({ row, into })
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
      />

      <UploadPanel queue={uploads} />
    </Shell>
  )
}

function Shell({ name, children }: { name?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <TopBar>
        {name && <span className="truncate text-[13px] text-ink-muted">{name}</span>}
      </TopBar>
      <main className="mx-auto max-w-[1180px] px-6 py-8">{children}</main>
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
