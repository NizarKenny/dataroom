import { Button } from '@/components/ui/button'
import { api, ApiError, putToStorage, type OnConflict } from '@/lib/api'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useReducer, useRef } from 'react'

type Status = 'waiting' | 'uploading' | 'conflict' | 'done' | 'error'

export interface Upload {
  id: string
  file: File
  name: string
  status: Status
  progress: number
  message?: string
  onConflict: OnConflict
}

/** Three at a time: enough to keep a fast connection busy, few enough to read. */
const AT_ONCE = 3

/**
 * The queue lives in a ref rather than in state, because an upload that finishes
 * has to look at what the queue holds right now, not at what it held when the
 * request started. State is only the render of it.
 */
export function useUploads(folderId: string, onFileAdded: () => void) {
  const store = useRef<Upload[]>([])
  const running = useRef(new Set<string>())
  const [, render] = useReducer((n: number) => n + 1, 0)

  function patch(id: string, changes: Partial<Upload>) {
    store.current = store.current.map((item) => (item.id === id ? { ...item, ...changes } : item))
    render()
  }

  async function run(id: string) {
    const item = store.current.find((candidate) => candidate.id === id)
    if (!item) return

    patch(id, { status: 'uploading', progress: 0, message: undefined })
    try {
      const ticket = await api.files.ticket(folderId, {
        name: item.name,
        sizeBytes: item.file.size,
        onConflict: item.onConflict,
      })

      await putToStorage(ticket.url, item.file, (fraction) => patch(id, { progress: fraction }))
      await api.files.record(folderId, ticket.fileId, ticket.name)

      patch(id, { status: 'done', progress: 1, name: ticket.name })
      onFileAdded()
    } catch (problem) {
      // A clash is not a failure, it is a question. The row turns into three
      // buttons and waits instead of making the choice for the reader.
      if (problem instanceof ApiError && problem.code === 'name_taken') {
        patch(id, { status: 'conflict', message: `${item.name} is already in this folder` })
      } else {
        patch(id, {
          status: 'error',
          message: problem instanceof Error ? problem.message : 'The upload did not go through',
        })
      }
    } finally {
      running.current.delete(id)
      schedule()
    }
  }

  function schedule() {
    while (running.current.size < AT_ONCE) {
      const next = store.current.find(
        (item) => item.status === 'waiting' && !running.current.has(item.id),
      )
      if (!next) return
      running.current.add(next.id)
      void run(next.id)
    }
  }

  return {
    items: store.current,

    add(files: File[]) {
      store.current = [
        ...store.current,
        ...files.map((file) => ({
          id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          name: file.name,
          status: 'waiting' as const,
          progress: 0,
          onConflict: 'fail' as const,
        })),
      ]
      render()
      schedule()
    },

    resolve(id: string, choice: 'rename' | 'replace' | 'skip') {
      if (choice === 'skip') {
        store.current = store.current.filter((item) => item.id !== id)
        render()
        return
      }
      patch(id, { status: 'waiting', onConflict: choice, message: undefined })
      schedule()
    },

    retry(id: string) {
      patch(id, { status: 'waiting', message: undefined })
      schedule()
    },

    clear() {
      store.current = store.current.filter(
        (item) => item.status !== 'done' && item.status !== 'error',
      )
      render()
    },
  }
}

export type UploadQueue = ReturnType<typeof useUploads>

export function UploadPanel({ queue }: { queue: UploadQueue }) {
  if (queue.items.length === 0) return null

  const settled = queue.items.filter((item) => item.status === 'done').length

  return (
    <div className="fixed right-6 bottom-6 z-40 w-[380px] overflow-hidden rounded-lg border border-hairline bg-surface shadow-soft">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5 text-[13px] font-medium">
        <span className="flex-1">
          {settled === queue.items.length
            ? `${settled} ${settled === 1 ? 'file' : 'files'} uploaded`
            : `Uploading ${settled + 1} of ${queue.items.length}`}
        </span>
        <Button variant="utility" size="icon" onClick={queue.clear} aria-label="Close">
          <X />
        </Button>
      </div>

      <div className="max-h-[280px] overflow-y-auto">
        {queue.items.map((item) => (
          <div key={item.id} className="border-b border-hairline px-4 py-2.5 last:border-b-0">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="flex-1 truncate">{item.name}</span>
              <span className="tabular text-xs text-ink-muted">
                {item.status === 'done' ? 'Done' : `${Math.round(item.progress * 100)}%`}
              </span>
            </div>

            <div className="mt-[7px] h-[3px] overflow-hidden rounded-full bg-sunken">
              <i
                className={cn(
                  'block h-full rounded-full transition-[width]',
                  item.status === 'error' || item.status === 'conflict'
                    ? 'bg-danger'
                    : 'bg-primary',
                )}
                style={{ width: `${Math.round(item.progress * 100)}%` }}
              />
            </div>

            {item.message && (
              <p
                className={cn(
                  'mt-1.5 text-[13px]',
                  item.status === 'error' || item.status === 'conflict'
                    ? 'text-danger'
                    : 'text-ink-muted',
                )}
              >
                {item.message}
              </p>
            )}

            {item.status === 'conflict' && (
              <div className="mt-2 flex gap-1.5">
                <Choice onClick={() => queue.resolve(item.id, 'rename')}>Keep both</Choice>
                <Choice onClick={() => queue.resolve(item.id, 'replace')}>Replace</Choice>
                <Choice onClick={() => queue.resolve(item.id, 'skip')}>Skip</Choice>
              </div>
            )}

            {item.status === 'error' && (
              <button
                className="mt-1.5 text-[13px] text-primary underline underline-offset-2"
                onClick={() => queue.retry(item.id)}
              >
                Try again
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Choice({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} className="text-[13px]">
      {children}
    </Button>
  )
}
