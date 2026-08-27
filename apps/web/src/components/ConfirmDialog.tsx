import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

/**
 * The shape every destructive step in this app takes: say what goes, count it,
 * and put the quiet danger button on the right.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  manifest,
  confirmLabel,
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false)

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

        <DialogFooter className="mt-6">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                onOpenChange(false)
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
