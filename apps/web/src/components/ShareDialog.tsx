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
import { initialsOf } from '@/lib/format'
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
  const [tab, setTab] = useState<'people' | 'link'>('people')

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        {target && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate">Share {target.name}</DialogTitle>
              <DialogDescription>
                Anyone given access here can also see everything inside it.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 flex gap-0.5 rounded-md bg-sunken p-0.5">
              <Tab on={tab === 'people'} onClick={() => setTab('people')}>
                People
              </Tab>
              <Tab on={tab === 'link'} onClick={() => setTab('link')}>
                Link
              </Tab>
            </div>

            <Body target={target} tab={tab} onChanged={onChanged} />
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

function Body({
  target,
  tab,
  onChanged,
}: {
  target: ShareTarget
  tab: 'people' | 'link'
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const key = ['shares', target.type, target.id]
  const shares = useQuery({ queryKey: key, queryFn: () => api.shares.list(target.type, target.id) })

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

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
    onError: (problem) => setError(problem instanceof Error ? problem.message : 'That did not work'),
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
  const inheritedLink = shares.data?.find((share) => share.mode === 'public_link' && share.inherited)

  if (tab === 'people') {
    return (
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
            placeholder="name@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" variant="primary" disabled={invite.isPending}>
            Invite
          </Button>
        </form>

        {error && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}

        <div className="mt-4">
          {people.length === 0 && (
            <p className="py-2 text-[13px] text-ink-muted">Nobody has been invited yet.</p>
          )}
          {people.map((share) => (
            <Grantee key={share.id} share={share} onRevoke={() => revoke.mutate(share.id)} />
          ))}
        </div>
      </div>
    )
  }

  return (
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
                toast.success('Link copied')
              }}
            >
              <Copy />
              Copy
            </Button>
          </div>
          <p className="mt-2 text-[13px] text-ink-muted">
            Anyone with this link can read this and everything inside it, without an account.
          </p>
          <Button
            variant="danger"
            className="mt-4"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate(link.id)}
          >
            Turn the link off
          </Button>
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
  )
}

function Grantee({ share, onRevoke }: { share: Share; onRevoke: () => void }) {
  const email = share.email ?? 'Unknown'

  return (
    <div className="flex items-center gap-2.5 border-b border-hairline py-2 text-sm last:border-b-0">
      <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-secondary-wash text-[11px] font-semibold text-secondary">
        {initialsOf(email)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate">{email}</span>
        {share.inherited && (
          <small className="block text-xs text-ink-faint">
            Given access on a folder above this one
          </small>
        )}
      </span>

      {/* Revoking an inherited share would cut off a whole branch, so it is done
          where it was granted, not here. */}
      {share.inherited ? (
        <span className="text-xs text-ink-faint">Inherited</span>
      ) : (
        <Button variant="utility" size="icon" onClick={onRevoke} aria-label={`Remove ${email}`}>
          <X />
        </Button>
      )}
    </div>
  )
}

const linkUrl = (token: string | null) => `${window.location.origin}/l/${token}`
