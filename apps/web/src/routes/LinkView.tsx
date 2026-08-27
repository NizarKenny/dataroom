import { Breadcrumbs } from '@/components/Breadcrumbs'
import { UpButton } from '@/components/UpButton'
import { FilePreview } from '@/components/FilePreview'
import { FileTable, type Row } from '@/components/FileTable'
import { ReaderBanner } from '@/components/ReaderBanner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import { useTheme } from '@/theme'
import { useQuery } from '@tanstack/react-query'
import { Download, Link2, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

/**
 * What the holder of a public link sees. No account, no toolbar, and no access
 * column: the reader is being shown documents, not the room's guest list.
 */
export function LinkView() {
  const { token = '', folderId } = useParams()
  const navigate = useNavigate()
  const [previewing, setPreviewing] = useState<Row | null>(null)

  const opened = useQuery({
    queryKey: ['link', token],
    queryFn: () => api.links.open(token),
    retry: false,
  })

  const shownFolder = folderId ?? opened.data?.folderId ?? null

  const view = useQuery({
    queryKey: ['link-folder', token, shownFolder],
    queryFn: () => api.links.folder(token, shownFolder!),
    enabled: shownFolder !== null,
  })

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
        ? ['This link no longer works', 'Whoever shared it has turned it off. Ask them for a new one.']
        : problem?.status === 404
          ? ['This link is not valid', 'Check that you copied the whole address.']
          : ['This link could not be opened', 'Something went wrong on our side. Try again in a moment.']

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
          <h1 className="truncate text-[26px] leading-[1.23] font-bold tracking-[-0.625px]">{file.name}</h1>
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
        <div className="mb-4 flex items-center gap-3">
          {/* Only inside the shared folder. At its top there is nowhere a link
              holder is allowed to go, so there is no button offering it. */}
          {parent && (
            <UpButton to={parent.name} onClick={() => navigate(`/l/${token}/f/${parent.id}`)} />
          )}
          <h1 className="min-w-0 flex-1 truncate text-[26px] leading-[1.23] font-bold tracking-[-0.625px]">
            {view.data.folder.name}
          </h1>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
        {view.data && (
          <>
            {view.data.breadcrumbs[0] && (
              <ReaderBanner grantedAt={view.data.breadcrumbs[0].name} through="link" />
            )}

            {view.data.breadcrumbs.length > 1 && (
              <Breadcrumbs
                trail={view.data.breadcrumbs}
                onNavigate={(id) => navigate(`/l/${token}/f/${id}`)}
                granted
              />
            )}

            {view.data.folders.length + view.data.files.length === 0 ? (
              <div className="px-6 py-13 text-center">
                <h2 className="text-xl font-semibold">This folder is empty</h2>
                <p className="mx-auto mt-2 max-w-[42ch] text-ink-muted">
                  Nothing has been put in here yet.
                </p>
              </div>
            ) : (
              <FileTable
                rows={[
                  ...view.data.folders.map((entry) => ({ kind: 'folder' as const, ...entry })),
                  ...view.data.files.map((entry) => ({ kind: 'file' as const, ...entry })),
                ]}
                onOpen={(row) =>
                  row.kind === 'folder' ? navigate(`/l/${token}/f/${row.id}`) : setPreviewing(row)
                }
              />
            )}
          </>
        )}

        {view.isPending && <Skeleton className="m-4 h-24" />}

        {view.isError && (
          <p className="px-6 py-13 text-center text-ink-muted">
            This folder could not be loaded. The link may have been switched off while you were
            reading.
          </p>
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
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-6">
          <span className="font-semibold tracking-[-0.02em]">Data Room</span>
          {room && <span className="truncate text-[13px] text-ink-muted">{room}</span>}

          {shared && (
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-primary-wash px-2.5 py-[3px] text-xs font-semibold text-primary-active">
              <Link2 className="size-3.5" />
              Shared with you
            </span>
          )}

          <Button
            variant="utility"
            size="icon"
            onClick={toggle}
            aria-label="Switch theme"
            className={shared ? undefined : 'ml-auto'}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-6 py-8">{children}</main>
    </div>
  )
}
