import { ancestorPaths } from './path.js'

export type ShareMode = 'public_link' | 'user'
export type ResourceType = 'data_room' | 'folder' | 'file'

/** A share that has not been revoked. Revoked rows never reach this module. */
export interface LiveShare {
  id: string
  resourceType: ResourceType
  resourceId: string
  /** The shared folder's path, or null for a share of a single file. */
  resourcePath: string | null
  mode: ShareMode
  granteeUserId: string | null
  /** Kept alongside the id so a share made before the person signed up still counts. */
  granteeEmail: string | null
}

export type Target =
  | { kind: 'folder'; id: string; path: string }
  | { kind: 'file'; id: string; folderPath: string }

function pathOf(target: Target): string {
  return target.kind === 'folder' ? target.path : target.folderPath
}

/**
 * The keys a share must match to reach this target: every folder above it (and
 * itself, for a folder), plus the file's own id when the target is a file.
 *
 * These go into the query as an `in (...)` list, so Postgres answers with an
 * index lookup on equality rather than walking the tree.
 */
export function lookupKeys(target: Target): { paths: string[]; fileId: string | null } {
  return {
    paths: ancestorPaths(pathOf(target)),
    fileId: target.kind === 'file' ? target.id : null,
  }
}

export function shareCovers(share: LiveShare, target: Target): boolean {
  if (share.resourceType === 'file') {
    return target.kind === 'file' && share.resourceId === target.id
  }
  if (share.resourcePath === null) return false
  return lookupKeys(target).paths.includes(share.resourcePath)
}

/**
 * Which share actually grants this target, when more than one does.
 *
 * The answer is shown to the reader ("visible to 3 people, granted at Financials"),
 * so it has to be the closest one: a share on the file itself beats a share on its
 * folder, which beats a share on the room. Depth is the path length, and a file
 * share has no path at all, hence the special case.
 */
export function pickGrantingShare(target: Target, shares: LiveShare[]): LiveShare | null {
  const covering = shares.filter((share) => shareCovers(share, target))
  if (covering.length === 0) return null

  const direct = covering.find((share) => share.resourceType === 'file')
  if (direct) return direct

  return covering.reduce((closest, share) =>
    (share.resourcePath ?? '').length > (closest.resourcePath ?? '').length ? share : closest,
  )
}

/**
 * Who a set of shares reaches, counted once each. The same person invited at two
 * levels is one person, and an invitation sent before they signed up is the same
 * person as the account that later claimed it.
 */
export function granteesOf(shares: LiveShare[]): number {
  const people = new Set<string>()
  for (const share of shares) {
    if (share.mode !== 'user') continue
    const who = share.granteeUserId ?? share.granteeEmail
    if (who) people.add(who)
  }
  return people.size
}

/**
 * True when the target's access was granted somewhere above it rather than on the
 * target itself. The listing draws its inheritance rail from this.
 */
export function isInherited(target: Target, share: LiveShare): boolean {
  if (share.resourceType === 'file') return false
  return share.resourcePath !== pathOf(target) || target.kind === 'file'
}
