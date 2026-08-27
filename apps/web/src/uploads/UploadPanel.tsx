import { Button } from '@/components/ui/button'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { useUploads } from './queue'

export type UploadQueue = ReturnType<typeof useUploads>

export function UploadPanel({ queue }: { queue: UploadQueue }) {
  const t = useT()

  if (queue.items.length === 0) return null

  const done = queue.items.filter((item) => item.status === 'done').length
  const asking = queue.items.filter((item) => item.status === 'conflict').length
  const failed = queue.items.filter((item) => item.status === 'error').length

  return (
    <div className="fixed right-6 bottom-6 z-40 w-[380px] overflow-hidden rounded-lg border border-hairline bg-surface shadow-soft">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5 text-[13px] font-medium">
        <span className="flex-1">
          {asking > 0
            ? t(d.upload.needsDecision(asking))
            : failed > 0
              ? t(d.upload.failedCount(failed))
              : done === queue.items.length
                ? t(d.upload.uploaded(done))
                : t(d.upload.uploading(done + 1, queue.items.length))}
        </span>
        <Button variant="utility" size="icon" onClick={queue.clear} aria-label={t(d.common.close)}>
          <X />
        </Button>
      </div>

      <div className="max-h-[280px] overflow-y-auto">
        {queue.items.map((item) => (
          <div key={item.id} className="border-b border-hairline px-4 py-2.5 last:border-b-0">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="flex-1 truncate">{item.name}</span>
              <span className="tabular text-xs text-ink-muted">
                {item.status === 'done' ? t(d.upload.done) : `${Math.round(item.progress * 100)}%`}
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
                <Choice onClick={() => queue.resolve(item.id, 'rename')}>
                  {t(d.upload.keepBoth)}
                </Choice>
                <Choice onClick={() => queue.resolve(item.id, 'version')}>
                  {t(d.upload.newVersion)}
                </Choice>
                <Choice onClick={() => queue.resolve(item.id, 'skip')}>{t(d.upload.skip)}</Choice>
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

function Choice({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button
      variant="utility"
      size="sm"
      onClick={onClick}
      className="border border-hairline-strong text-[13px]"
    >
      {children}
    </Button>
  )
}
