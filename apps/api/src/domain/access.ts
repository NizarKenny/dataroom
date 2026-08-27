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

/**
 * The same keys, shaped for asking the question many times over. A folder listing
 * checks every share in the room against every row, so the keys for a row are
 * built once and the membership test is a hash lookup rather than a scan.
 */
export interface TargetKeys {
  paths: Set<string>
  fileId: string | null
}

export function keysFor(target: Target): TargetKeys {
  const keys = lookupKeys(target)
  return { paths: new Set(keys.paths), fileId: keys.fileId }
}

export function covers(keys: TargetKeys, share: LiveShare): boolean {
  if (share.resourceType === 'file') {
    return keys.fileId !== null && share.resourceId === keys.fileId
  }
  return share.resourcePath !== null && keys.paths.has(share.resourcePath)
}

/** One target against one share. For a whole listing, use keysFor and covers. */
export function shareCovers(share: LiveShare, target: Target): boolean {
  return covers(keysFor(target), share)
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
  const keys = keysFor(target)
  return closestOf(shares.filter((share) => covers(keys, share)))
}

/** The same choice, when the caller has already worked out what covers the target. */
export function closestOf(covering: LiveShare[]): LiveShare | null {
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

/**
 * What a listing draws next to a row. Only ever built for the owner: a reader who
 * was let into one folder has no business knowing who else was let in.
 */
export interface AccessBadge {
  /** Everyone this node is visible to, counted once each, however it arrived. */
  people: number
  /** A link reaches this node, from here or from above. */
  link: boolean
  /** What was granted on this node itself, which is what a row's chip says. */
  here: { people: number; link: boolean }
  /** Something above it also reaches it, which is what the rail draws. */
  inherited: boolean
  /** The closest node above that access comes from, for naming it. */
  grantedAt: string | null
}

export function badgeFor(target: Target, shares: LiveShare[]): AccessBadge {
  // The keys are built once and every share is tested against them by hash. A
  // listing runs this per row, so doing it the other way round makes the cost of
  // drawing a folder the product of its rows and the room's shares.
  const keys = keysFor(target)
  const covering = shares.filter((share) => covers(keys, share))
  const here = covering.filter((share) => !isInherited(target, share))
  const closest = closestOf(covering)

  return {
    people: granteesOf(covering),
    link: covering.some((share) => share.mode === 'public_link'),
    here: {
      people: granteesOf(here),
      link: here.some((share) => share.mode === 'public_link'),
    },
    inherited: covering.length > here.length,
    grantedAt: closest && isInherited(target, closest) ? closest.resourceId : null,
  }
}
