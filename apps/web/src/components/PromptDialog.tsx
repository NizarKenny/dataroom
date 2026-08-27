import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useEffect, useState, type FormEvent } from 'react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label: string
  submitLabel: string
  initialValue?: string
  onSubmit: (value: string) => Promise<void>
}

/**
 * Every place that asks for a name: a new room, a new folder, a rename. They all
 * fail the same way too, so the error from the API lands under the field rather
 * than in a toast the reader has to go and read.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  submitLabel,
  initialValue = '',
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setError(null)
    }
  }, [open, initialValue])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit(value.trim())
      onOpenChange(false)
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That did not work')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </DialogHeader>

          <div className="mt-4">
            <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">
              {label}
            </label>
            <Input
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onFocus={(event) => event.target.select()}
              aria-invalid={error !== null}
            />
            {error && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy || value.trim().length === 0}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
