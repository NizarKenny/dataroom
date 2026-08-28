import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
import { useState, type ReactNode } from 'react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** What disappears, counted. Left out when there is nothing to count. */
  manifest?: { label: string; value: ReactNode }[]
  confirmLabel: string
  onConfirm: () => Promise<void>
}

/** Every destructive step takes this shape: say what goes, and count it. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  manifest,
  confirmLabel,
  onConfirm,
}: Props) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {manifest && manifest.length > 0 && (
          <div className="mt-4 rounded-md bg-sunken px-4 py-3">
            {manifest.map((line) => (
              <div
                key={line.label}
                className="flex justify-between py-[3px] text-[13px] text-ink-secondary"
              >
                <span>{line.label}</span>
                <span className="tabular font-mono">{line.value}</span>
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

        <DialogFooter className="mt-6">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t(d.common.cancel)}
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await onConfirm()
                onOpenChange(false)
              } catch (problem) {
                setError(problem instanceof Error ? problem.message : t(d.common.didNotWork))
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
