import type { File, Folder } from '@prisma/client'
import { badgeFor, type LiveShare } from './domain/access.js'
import { prisma } from './db.js'
import { segments } from './domain/path.js'
import {
  fileTarget,
  folderTarget,
  liveSharesIn,
  openFolder,
  type Grant,
  type Viewer,
} from './permissions.js'

/**
 * One folder as the browser draws it. The signed-in route and the public link
 * route both end up here, so a link holder and an invited reader are answered by
 * exactly the same code and cannot drift apart.
 */
export async function folderView(viewer: Viewer, folderId: string) {
  const { folder, room, grant } = await openFolder(viewer, folderId)

  // The rail and the people count are the owner's view of their own room. A
  // reader who was let into one folder is not told who else was let in.
  const shares = grant.role === 'owner' ? await liveSharesIn(room.id) : null

  const [folders, files, breadcrumbs] = await Promise.all([
    prisma.folder.findMany({ where: { parentId: folder.id }, orderBy: { name: 'asc' } }),
    prisma.file.findMany({ where: { folderId: folder.id }, orderBy: { name: 'asc' } }),
    trailTo(folder, grant),
  ])

  // A reader has no way up out of the folder they were given.
  const grantedHere = grant.via?.resourcePath === folder.path

  return {
    room: { id: room.id, name: room.name, role: grant.role },
    folder: {
      id: folder.id,
      name: folder.name,
      parentId: grantedHere ? null : folder.parentId,
      // Why everything in this listing is reachable. The browser says it once at
      // the top instead of repeating it on every row.
      access: shares ? badgeFor(folderTarget(folder), shares) : null,
    },
    breadcrumbs,
    folders: folders.map((child) => folderRow(child, shares)),
    files: files.map((file) => fileRow(file, folder, shares)),
  }
}

export function folderRow(folder: Folder, shares: LiveShare[] | null) {
  return {
    id: folder.id,
    name: folder.name,
    updatedAt: folder.updatedAt,
    access: shares ? badgeFor(folderTarget(folder), shares) : null,
  }
}

export function fileRow(file: File, folder: Folder, shares: LiveShare[] | null) {
  return {
    id: file.id,
    name: file.name,
    // Postgres counts bytes in int8 and JSON has no such thing. Every size here
    // is far below the point where a double loses precision.
    sizeBytes: Number(file.sizeBytes),
    mimeType: file.mimeType,
    updatedAt: file.updatedAt,
    access: shares ? badgeFor(fileTarget(file, folder), shares) : null,
  }
}

/** Root to here, clipped so a reader never sees the names of folders above their own. */
async function trailTo(folder: Folder, grant: Grant) {
  const ids = segments(folder.path)
  const rows = await prisma.folder.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, path: true },
  })

  const byId = new Map(rows.map((row) => [row.id, row]))
  const trail = ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })

  const grantedAt = grant.via?.resourcePath ?? null
  const start = grantedAt === null ? 0 : trail.findIndex((row) => row.path === grantedAt)
  return trail.slice(Math.max(start, 0)).map(({ id, name }) => ({ id, name }))
}
