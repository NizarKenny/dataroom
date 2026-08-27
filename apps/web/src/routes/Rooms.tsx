import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FilePreview } from '@/components/FilePreview'
import { PromptDialog } from '@/components/PromptDialog'
import { TopBar } from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type RoomSummary } from '@/lib/api'
import { formatBytes, formatWhen } from '@/lib/format'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export function Rooms() {
  const t = useT()
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: api.rooms.list })
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<RoomSummary | null>(null)
  const [deleting, setDeleting] = useState<RoomSummary | null>(null)
  // A reader whose only access is one file has no folder to open, so the room
  // opens straight into the document.
  const [previewing, setPreviewing] = useState<{
    id: string
    name: string
    sizeBytes: number
    mimeType: string
  } | null>(null)

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['rooms'] })
  }

  const create = useMutation({
    mutationFn: (name: string) => api.rooms.create(name),
    onSuccess: (room) => {
      refresh()
      navigate(`/f/${room.rootFolderId}`)
    },
  })

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.rooms.rename(id, name),
    onSuccess: refresh,
  })

  const remove = useMutation({
    mutationFn: (room: RoomSummary) => api.rooms.remove(room.id),
    onSuccess: (_result, room) => {
      refresh()
      toast.success(`${room.name} deleted`)
    },
    onError: (problem) =>
      toast.error(problem instanceof Error ? problem.message : t(d.browser.deleteFailed)),
  })

  async function openRoom(room: RoomSummary) {
    if (!room.entry.id) return
    if (room.entry.kind === 'folder') {
      navigate(`/f/${room.entry.id}`)
      return
    }

    const link = await api.files.download(room.entry.id)
    setPreviewing({
      id: room.entry.id,
      name: link.name,
      sizeBytes: link.sizeBytes,
      mimeType: link.mimeType,
    })
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <TopBar />

      <main className="mx-auto max-w-[1180px] px-6 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] leading-[1.23] font-bold tracking-[-0.625px]">
              {t(d.rooms.title)}
            </h1>
            <p className="mt-1 text-ink-muted">{t(d.rooms.lede)}</p>
          </div>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus />
            New data room
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
          {rooms.isPending && (
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-5 w-40" />
            </div>
          )}

          {rooms.isError && (
            <p className="p-6 text-[15px] text-danger">
              Your data rooms could not be loaded. Try again in a moment.
            </p>
          )}

          {rooms.data?.length === 0 && (
            <div className="px-6 py-13 text-center">
              <h2 className="text-xl font-semibold">{t(d.rooms.empty)}</h2>
              <p className="mx-auto mt-2 mb-4 max-w-[42ch] text-ink-muted">
                A data room holds the documents for one deal, and decides who can see which parts of
                them.
              </p>
              <Button variant="primary" onClick={() => setCreating(true)}>
                {t(d.rooms.createFirst)}
              </Button>
            </div>
          )}

          {rooms.data?.map((room) => (
            <div
              key={room.id}
              className="group flex items-center border-b border-hairline last:border-b-0 hover:bg-sunken"
            >
              <button
                onClick={() => void openRoom(room)}
                className="flex min-w-0 flex-1 items-center gap-4 px-4 py-[13px] text-left"
              >
                <span className="flex-1 truncate">{room.name}</span>

                {room.role === 'viewer' ? (
                  <span className="rounded-full bg-secondary-wash px-2.5 py-[3px] text-xs font-semibold text-secondary">
                    {t(d.rooms.sharedWithYou)}
                  </span>
                ) : (
                  <span className="tabular text-[13px] whitespace-nowrap text-ink-muted">
                    {room.files} {room.files === 1 ? 'file' : 'files'} ·{' '}
                    {formatBytes(room.bytes ?? 0)}
                  </span>
                )}

                <span className="w-24 text-right text-[13px] whitespace-nowrap text-ink-faint">
                  {formatWhen(room.updatedAt)}
                </span>
              </button>

              {/* The same width for a reader with no menu, so the rows line up. */}
              <div className="w-11 pr-3">
                {room.role === 'owner' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="utility"
                        size="icon"
                        className="text-ink-faint opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                        aria-label={t(d.columns.actionsFor(room.name))}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onSelect={() => setRenaming(room)}>
                        <Pencil />
                        {t(d.common.rename)}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(room)}>
                        <Trash2 />
                        {t(d.common.delete)}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <FilePreview
        file={previewing}
        onOpenChange={(open) => !open && setPreviewing(null)}
        getLink={(id, disposition) => api.files.download(id, disposition)}
        scope="account"
      />

      <PromptDialog
        open={creating}
        onOpenChange={setCreating}
        title="New data room"
        description="Name it after the deal. You can rename it later."
        label="Name"
        submitLabel="Create"
        onSubmit={async (name) => {
          await create.mutateAsync(name)
        }}
      />

      <PromptDialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
        title={t(d.browser.renameTitle(renaming?.name ?? ''))}
        label="Name"
        submitLabel="Rename"
        initialValue={renaming?.name}
        onSubmit={async (name) => {
          if (renaming) await rename.mutateAsync({ id: renaming.id, name })
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}?`}
        description="The whole room goes, with every document in it and every link into it. This cannot be undone."
        manifest={
          deleting
            ? [
                { label: 'Files', value: deleting.files ?? 0 },
                { label: 'Size', value: formatBytes(deleting.bytes ?? 0) },
              ]
            : undefined
        }
        confirmLabel="Delete the data room"
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting)
        }}
      />
    </div>
  )
}
