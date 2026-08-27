import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api, type ResourceType, type Share } from '@/lib/api'
import { d } from '@/lib/dictionary'
import { initialsOf } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Link2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

export interface ShareTarget {
  type: ResourceType
  id: string
  name: string
}

interface Props {
  target: ShareTarget | null
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

export function ShareDialog({ target, onOpenChange, onChanged }: Props) {
  const t = useT()

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        {target && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate">{t(d.share.title(target.name))}</DialogTitle>
              <DialogDescription>{t(d.share.lede)}</DialogDescription>
            </DialogHeader>

            <Body target={target} onChanged={onChanged} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Tab({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 rounded-[6px] px-3 py-1.5 text-sm font-medium text-ink-muted',
        on && 'bg-surface text-ink shadow-soft',
      )}
    >
      {children}
    </button>
  )
}

function Body({ target, onChanged }: { target: ShareTarget; onChanged: () => void }) {
  const t = useT()
  const queryClient = useQueryClient()
  const key = ['shares', target.type, target.id]
  const shares = useQuery({
    queryKey: key,
    queryFn: () => api.shares.list(target.type, target.id),
  })

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [chosen, setChosen] = useState<'people' | 'link' | null>(null)
  const [turningOff, setTurningOff] = useState(false)

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: key })
    onChanged()
  }

  const invite = useMutation({
    mutationFn: (address: string) =>
      api.shares.create({
        resourceType: target.type,
        resourceId: target.id,
        mode: 'user',
        email: address,
      }),
    onSuccess: () => {
      setEmail('')
      refresh()
    },
    onError: (problem) =>
      setError(problem instanceof Error ? problem.message : t(d.common.didNotWork)),
  })

  const createLink = useMutation({
    mutationFn: () =>
      api.shares.create({
        resourceType: target.type,
        resourceId: target.id,
        mode: 'public_link',
      }),
    onSuccess: refresh,
  })

  const revoke = useMutation({
    mutationFn: (id: string) => api.shares.revoke(id),
    onSuccess: refresh,
  })

  const people = shares.data?.filter((share) => share.mode === 'user') ?? []
  const link = shares.data?.find((share) => share.mode === 'public_link' && !share.inherited)
  const inheritedLink = shares.data?.find(
    (share) => share.mode === 'public_link' && share.inherited,
  )

  // Opening on an empty People tab over a folder that has a live link tells the
  // owner nobody can see it. The tab that has something to say goes first.
  const tab = chosen ?? (link && people.length === 0 ? 'link' : 'people')

  const tabs = (
    <div className="mt-4 flex gap-0.5 rounded-md bg-sunken p-0.5">
      <Tab on={tab === 'people'} onClick={() => setChosen('people')}>
        {t(d.share.people)}
        {people.length > 0 && ` · ${people.length}`}
      </Tab>
      <Tab on={tab === 'link'} onClick={() => setChosen('link')}>
        {t(link ? d.share.linkOn : d.share.link)}
      </Tab>
    </div>
  )

  if (tab === 'people') {
    return (
      <div>
        {tabs}
        <div className="mt-4">
          <form
            className="flex gap-2"
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              setError(null)
              invite.mutate(email.trim().toLowerCase())
            }}
          >
            <Input
              type="email"
              required
              placeholder={t(d.share.emailPlaceholder)}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" variant="primary" disabled={invite.isPending}>
              {t(d.share.invite)}
            </Button>
          </form>

          {error && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}

          <div className="mt-4">
            {people.length === 0 && (
              <p className="py-2 text-[13px] text-ink-muted">
                {t(link ? d.share.nobodyButLink : d.share.nobodyYet)}
              </p>
            )}
            {people.map((share) => (
              <Grantee key={share.id} share={share} onRevoke={() => revoke.mutate(share.id)} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {tabs}
      <div className="mt-4">
        {inheritedLink && (
          <p className="mb-3 rounded-md bg-primary-wash px-3 py-2 text-[13px] text-primary-active">
            A link to a folder above this one already reaches it.
          </p>
        )}

        {link ? (
          <>
            <div className="flex gap-2">
              <Input
                readOnly
                value={linkUrl(link.token)}
                onFocus={(event) => event.target.select()}
                className="font-mono text-xs text-ink-muted"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(linkUrl(link.token))
                  toast.success(t(d.share.copied))
                }}
              >
                <Copy />
                {t(d.share.copy)}
              </Button>
            </div>
            <p className="mt-2 text-[13px] text-ink-muted">
              Anyone with this link can read this and everything inside it, without an account.
              Turning it off breaks every copy of it that has been sent.
            </p>
            <Button variant="danger" className="mt-4" onClick={() => setTurningOff(true)}>
              Turn the link off
            </Button>

            <ConfirmDialog
              open={turningOff}
              onOpenChange={setTurningOff}
              title="Turn this link off?"
              description="Every copy of it stops working, wherever it has been sent. Anyone who needs access after that has to be given a new link or invited by name."
              confirmLabel="Turn it off"
              onConfirm={async () => {
                await revoke.mutateAsync(link.id)
              }}
            />
          </>
        ) : (
          <>
            <p className="text-[13px] text-ink-muted">
              A link lets someone read this without an account. You can turn it off again at any
              time.
            </p>
            <Button
              variant="primary"
              className="mt-4"
              disabled={createLink.isPending}
              onClick={() => createLink.mutate()}
            >
              <Link2 />
              Create a link
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function Grantee({ share, onRevoke }: { share: Share; onRevoke: () => void }) {
  const t = useT()
  const email = share.email ?? t(d.share.unknown)

  return (
    <div className="flex items-center gap-2.5 border-b border-hairline py-2 text-sm last:border-b-0">
      <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-secondary-wash text-[11px] font-semibold text-secondary">
        {initialsOf(email)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate">{email}</span>
        {share.inherited && (
          <small className="block text-xs text-ink-faint">{t(d.share.givenAbove)}</small>
        )}
      </span>

      {/* Revoking an inherited share would cut off a whole branch, so it is done
          where it was granted, not here. */}
      {share.inherited ? (
        <span className="text-xs text-ink-faint">{t(d.share.inherited)}</span>
      ) : (
        <Button
          variant="utility"
          size="icon"
          onClick={onRevoke}
          aria-label={t(d.share.remove(email))}
        >
          <X />
        </Button>
      )}
    </div>
  )
}

const linkUrl = (token: string | null) => `${window.location.origin}/l/${token}`
