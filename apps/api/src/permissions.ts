import type { DataRoom, File, Folder, Share } from '@prisma/client'
import { prisma } from './db.js'
import { notFound, readOnly, shareRevoked } from './errors.js'
import {
  isInherited,
  lookupKeys,
  pickGrantingShare,
  shareCovers,
  type LiveShare,
  type Target,
} from './domain/access.js'

/** Whoever is asking: a signed-in account, or the holder of a public link. */
export type Viewer =
  | { kind: 'user'; userId: string }
  | { kind: 'link'; dataRoomId: string; share: LiveShare }

export interface Grant {
  role: 'owner' | 'viewer'
  /** The share access came through, or null when the viewer owns the room. */
  via: LiveShare | null
}

const LIVE_SHARE = {
  id: true,
  resourceType: true,
  resourceId: true,
  resourcePath: true,
  mode: true,
  granteeUserId: true,
} as const

export const folderTarget = (folder: Folder): Target => ({
  kind: 'folder',
  id: folder.id,
  path: folder.path,
})

export const fileTarget = (file: File, folder: Folder): Target => ({
  kind: 'file',
  id: file.id,
  folderPath: folder.path,
})

export const toLiveShare = (share: Share): LiveShare => ({
  id: share.id,
  resourceType: share.resourceType,
  resourceId: share.resourceId,
  resourcePath: share.resourcePath,
  mode: share.mode,
  granteeUserId: share.granteeUserId,
})

/**
 * The one question this module exists to answer: may this viewer see this node,
 * and if so, through what.
 *
 * For a signed-in reader the answer is a single indexed query. lookupKeys turns
 * the node into the handful of keys a share would have to carry to reach it, so
 * Postgres matches on equality instead of walking the tree upwards.
 */
async function grantFor(viewer: Viewer, room: DataRoom, target: Target): Promise<Grant> {
  if (viewer.kind === 'link') {
    if (viewer.dataRoomId !== room.id) throw notFound()
    if (!shareCovers(viewer.share, target)) throw notFound()
    return { role: 'viewer', via: viewer.share }
  }

  if (room.ownerId === viewer.userId) return { role: 'owner', via: null }

  const keys = lookupKeys(target)
  const shares = await prisma.share.findMany({
    where: {
      dataRoomId: room.id,
      revokedAt: null,
      granteeUserId: viewer.userId,
      OR: [
        { resourcePath: { in: keys.paths } },
        ...(keys.fileId ? [{ resourceType: 'file' as const, resourceId: keys.fileId }] : []),
      ],
    },
    select: LIVE_SHARE,
  })

  const via = pickGrantingShare(target, shares)
  if (!via) throw notFound()
  return { role: 'viewer', via }
}

export async function openRoom(viewer: Viewer, roomId: string) {
  const room = await prisma.dataRoom.findUnique({
    where: { id: roomId },
    include: { folders: { where: { parentId: null } } },
  })
  const root = room?.folders[0]
  if (!room || !root) throw notFound('data room')

  return { room, root, grant: await grantFor(viewer, room, folderTarget(root)) }
}

export async function openFolder(viewer: Viewer, folderId: string) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    include: { dataRoom: true },
  })
  if (!folder) throw notFound('folder')

  const room = folder.dataRoom
  return { folder, room, grant: await grantFor(viewer, room, folderTarget(folder)) }
}

export async function openFile(viewer: Viewer, fileId: string) {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { dataRoom: true, folder: true },
  })
  if (!file) throw notFound('file')

  const room = file.dataRoom
  const grant = await grantFor(viewer, room, fileTarget(file, file.folder))
  return { file, folder: file.folder, room, grant }
}

export async function openLink(token: string) {
  const share = await prisma.share.findUnique({ where: { token }, include: { dataRoom: true } })
  if (!share) throw notFound('link')
  // Being told the link was switched off is only available to someone already
  // holding the token, so it gives nothing away and saves the reader a guess.
  if (share.revokedAt) throw shareRevoked()

  const viewer: Viewer = {
    kind: 'link',
    dataRoomId: share.dataRoomId,
    share: toLiveShare(share),
  }
  return { share, room: share.dataRoom, viewer }
}

export function requireOwner(grant: Grant): void {
  if (grant.role !== 'owner') throw readOnly()
}

export function liveSharesIn(dataRoomId: string): Promise<LiveShare[]> {
  return prisma.share.findMany({
    where: { dataRoomId, revokedAt: null },
    select: LIVE_SHARE,
  })
}

/**
 * Live shares whose target sits inside a folder. Folder shares carry their path,
 * so they are a string comparison; file shares carry none, so the few of them
 * there are get resolved through their file in one extra query.
 */
export async function sharesInSubtree(dataRoomId: string, path: string): Promise<LiveShare[]> {
  const shares = await liveSharesIn(dataRoomId)
  const belowPath = shares.filter((share) => share.resourcePath?.startsWith(path))
  const fileShares = shares.filter((share) => share.resourceType === 'file')
  if (fileShares.length === 0) return belowPath

  const inside = await prisma.file.findMany({
    where: {
      id: { in: fileShares.map((share) => share.resourceId) },
      folder: { path: { startsWith: path } },
    },
    select: { id: true },
  })

  const insideIds = new Set(inside.map((file) => file.id))
  return [...belowPath, ...fileShares.filter((share) => insideIds.has(share.resourceId))]
}

/**
 * What the listing draws next to a row. Only ever built for the owner: a reader
 * who was let into one folder has no business knowing who else was let in.
 */
export interface AccessBadge {
  /** Accounts and pending invitations that reach this row. */
  people: number
  /** A public link reaches this row. */
  link: boolean
  /** Something was shared on this row itself. */
  direct: boolean
  /** Something was shared above it, which is what the rail in the table draws. */
  inherited: boolean
  /** Id of the closest node access comes from, for the tooltip. */
  grantedAt: string | null
}

export function badgeFor(target: Target, shares: LiveShare[]): AccessBadge {
  const covering = shares.filter((share) => shareCovers(share, target))
  const closest = pickGrantingShare(target, covering)

  return {
    people: new Set(
      covering.filter((share) => share.mode === 'user').map((share) => share.id),
    ).size,
    link: covering.some((share) => share.mode === 'public_link'),
    direct: covering.some((share) => !isInherited(target, share)),
    inherited: covering.some((share) => isInherited(target, share)),
    grantedAt: closest && isInherited(target, closest) ? closest.resourceId : null,
  }
}
