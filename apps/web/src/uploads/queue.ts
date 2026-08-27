import { api, ApiError, putToStorage, type OnConflict } from '@/lib/api'
import { useReducer, useRef } from 'react'

type Status = 'waiting' | 'uploading' | 'conflict' | 'done' | 'error'

export interface Upload {
  id: string
  file: File
  name: string
  /** Fixed when the file is dropped. The reader may walk away before it lands. */
  folderId: string
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
 *
 * That also means the queue outlives a walk to another folder, so each item
 * carries the folder it was dropped into rather than reading whichever one is on
 * screen when it finishes.
 */
export function useUploads(folderId: string, onFileAdded: (into: string) => void) {
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
      const ticket = await api.files.ticket(item.folderId, {
        name: item.name,
        sizeBytes: item.file.size,
        onConflict: item.onConflict,
      })

      await putToStorage(ticket.url, item.file, (fraction) => patch(id, { progress: fraction }))
      await api.files.record(item.folderId, ticket.fileId, ticket.name)

      patch(id, { status: 'done', progress: 1, name: ticket.name })
      onFileAdded(item.folderId)
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
          folderId,
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
