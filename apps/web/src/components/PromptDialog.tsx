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
import { ApiError } from '@/lib/api'
import { d } from '@/lib/dictionary'
import { useT } from '@/lib/i18n'
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
  const t = useT()
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [free, setFree] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setError(null)
      setFree(null)
    }
  }, [open, initialValue])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setFree(null)
    try {
      await onSubmit(value.trim())
      onOpenChange(false)
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t(d.common.didNotWork))
      // The API works out a free name when it rejects a taken one. Offering it
      // is the same courtesy the upload queue gives: the reader wanted this
      // name, and the nearest one to it is a better answer than a blank field.
      const taken = problem instanceof ApiError && problem.code === 'name_taken'
      const suggestion = taken ? problem.detail?.free : undefined
      setFree(typeof suggestion === 'string' ? suggestion : null)
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
            {free && (
              <button
                type="button"
                onClick={() => {
                  setValue(free)
                  setError(null)
                  setFree(null)
                }}
                className="mt-1.5 text-[13px] text-primary hover:text-primary-active"
              >
                {t(d.browser.useName(free))}
              </button>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t(d.common.cancel)}
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
