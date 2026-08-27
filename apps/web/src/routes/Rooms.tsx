import { FilePreview } from '@/components/FilePreview'
import { PromptDialog } from '@/components/PromptDialog'
import { TopBar } from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type RoomSummary } from '@/lib/api'
import { formatBytes, formatWhen } from '@/lib/format'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function Rooms() {
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: api.rooms.list })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  // A reader whose only access is one file has no folder to open, so the room
  // opens straight into the document.
  const [previewing, setPreviewing] = useState<{
    id: string
    name: string
    sizeBytes: number
    mimeType: string
  } | null>(null)

  const create = useMutation({
    mutationFn: (name: string) => api.rooms.create(name),
    onSuccess: (room) => {
      void queryClient.invalidateQueries({ queryKey: ['rooms'] })
      navigate(`/f/${room.rootFolderId}`)
    },
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
            <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em]">Data rooms</h1>
            <p className="mt-1 text-ink-muted">Rooms you own, and rooms shared with you.</p>
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
              The rooms could not be loaded. Check that the API is running.
            </p>
          )}

          {rooms.data?.length === 0 && (
            <div className="px-6 py-13 text-center">
              <h2 className="text-xl font-semibold">Nothing here yet</h2>
              <p className="mx-auto mt-2 mb-4 max-w-[42ch] text-ink-muted">
                A data room holds the documents for one deal, and decides who can see which parts
                of them.
              </p>
              <Button variant="primary" onClick={() => setCreating(true)}>
                Create the first one
              </Button>
            </div>
          )}

          {rooms.data?.map((room) => (
            <button
              key={room.id}
              onClick={() => void openRoom(room)}
              className="flex w-full items-center gap-4 border-b border-hairline px-4 py-[13px] text-left last:border-b-0 hover:bg-sunken"
            >
              <span className="flex-1 truncate">{room.name}</span>

              {room.role === 'viewer' ? (
                <span className="rounded-full bg-secondary-wash px-2.5 py-[3px] text-xs font-semibold text-secondary">
                  Shared with you
                </span>
              ) : (
                <span className="tabular text-[13px] whitespace-nowrap text-ink-muted">
                  {room.files} {room.files === 1 ? 'file' : 'files'} · {formatBytes(room.bytes ?? 0)}
                </span>
              )}

              <span className="w-24 text-right text-[13px] whitespace-nowrap text-ink-faint">
                {formatWhen(room.updatedAt)}
              </span>
            </button>
          ))}
        </div>
      </main>

      <FilePreview
        file={previewing}
        onOpenChange={(open) => !open && setPreviewing(null)}
        getLink={(id, disposition) => api.files.download(id, disposition)}
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
    </div>
  )
}
