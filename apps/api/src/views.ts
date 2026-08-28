import type { DataRoom, File, Folder } from '@prisma/client'
import { badgeFor, type LiveShare } from './domain/access.js'
import { prisma } from './db.js'
import { segments } from './domain/path.js'
import {
  fileTarget,
  folderTarget,
  liveSharesIn,
  openFolder,
  readableIn,
  type Grant,
  type ReadScope,
  type Viewer,
} from './permissions.js'

/** Rows on one page of a listing, folders and files counted together. */
export const PAGE_ROWS = 50

/** What a listing is ordered by, and which way. */
export type SortBy = 'name' | 'size' | 'modified'
export type SortDir = 'asc' | 'desc'

/**
 * Folders keep their block at the top whatever the sort, because a folder and a
 * file are different kinds of thing and interleaving them by size would put an
 * empty cell between two numbers. A folder has no size, so when that is what is
 * being sorted the folders fall back to their names.
 */
function ordering(by: SortBy, dir: SortDir) {
  return {
    folders: by === 'modified' ? { updatedAt: dir } : { name: by === 'size' ? 'asc' : dir },
    files: by === 'name' ? { name: dir } : by === 'size' ? { sizeBytes: dir } : { updatedAt: dir },
  } as const
}

/** How far back a listing is willing to look, as the filter offers it. */
export type Modified = 'any' | 'today' | 'week' | 'month' | 'year'

const DAYS: Record<Exclude<Modified, 'any'>, number> = {
  today: 1,
  week: 7,
  month: 30,
  year: 365,
}

/**
 * The cutoff, worked out on the server. A browser with a wrong clock would
 * otherwise ask for a window that does not match what it says on the button.
 */
function since(window: Modified): Date | null {
  if (window === 'any') return null
  return new Date(Date.now() - DAYS[window] * 24 * 60 * 60 * 1000)
}

/**
 * One folder as the browser draws it. The signed-in route and the public link
 * route both end up here, so a link holder and an invited reader are answered by
 * exactly the same code and cannot drift apart.
 *
 * The listing is one sequence, folders first and then files, both by name, and a
 * page is a window over it. Offset rather than keyset, because a pager with page
 * numbers has to be able to jump to the seventh, and keyset only knows how to go
 * next. The price is that a deep page counts rows it will not return; the win is
 * that no folder ever draws more than fifty rows.
 */
export async function folderView(
  viewer: Viewer,
  folderId: string,
  page = 1,
  modified: Modified = 'any',
  sort: SortBy = 'name',
  dir: SortDir = 'asc',
) {
  const { folder, room, grant } = await openFolder(viewer, folderId)

  // The rail and the people count are the owner's view of their own room. A
  // reader who was let into one folder is not told who else was let in.
  const shares = grant.role === 'owner' ? await liveSharesIn(room.id) : null

  // The filter belongs on the count as much as on the rows: a pager built from
  // the unfiltered total would offer pages that come back empty.
  const cutoff = since(modified)
  const recent = cutoff ? { updatedAt: { gte: cutoff } } : {}

  const [folderCount, fileCount] = await Promise.all([
    prisma.folder.count({ where: { parentId: folder.id, ...recent } }),
    prisma.file.count({ where: { folderId: folder.id, ...recent } }),
  ])

  const total = folderCount + fileCount
  const pages = Math.max(1, Math.ceil(total / PAGE_ROWS))
  const current = Math.min(Math.max(1, Math.trunc(page)), pages)
  const from = (current - 1) * PAGE_ROWS

  // The window can land wholly in the folders, wholly in the files, or across
  // the seam. Asking for a slice of each and letting one come back empty is the
  // whole of it.
  const folderSlice = Math.max(0, Math.min(PAGE_ROWS, folderCount - from))

  const order = ordering(sort, dir)

  const [folders, files, breadcrumbs] = await Promise.all([
    folderSlice === 0
      ? Promise.resolve([])
      : prisma.folder.findMany({
          where: { parentId: folder.id, ...recent },
          orderBy: order.folders,
          skip: from,
          take: folderSlice,
        }),
    PAGE_ROWS - folderSlice === 0
      ? Promise.resolve([])
      : prisma.file.findMany({
          where: { folderId: folder.id, ...recent },
          orderBy: order.files,
          skip: Math.max(0, from - folderCount),
          take: PAGE_ROWS - folderSlice,
        }),
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
    // Said even when there is one page, so the browser never has to guess.
    page: { number: current, pages, total, size: PAGE_ROWS, modified, sort, dir },
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

/** Enough to be useful, few enough that the reader keeps typing instead of scrolling. */
const RESULTS = 50

/**
 * Files anywhere in one room whose name contains what was typed, cut down to the
 * part of the room this viewer may read, and each one told where it sits. The
 * trail is the point: a name alone does not tell the third copy of "Disclosure
 * schedule" from the first two.
 */
export async function searchView(viewer: Viewer, room: DataRoom, query: string) {
  const scope = await readableIn(viewer, room)

  const files = await prisma.file.findMany({
    where: {
      dataRoomId: room.id,
      name: { contains: escapeForLike(query), mode: 'insensitive' },
      ...(scope ? { OR: reachable(scope) } : {}),
    },
    include: { folder: true },
    orderBy: { name: 'asc' },
    take: RESULTS,
  })

  const shares = scope === null ? await liveSharesIn(room.id) : null
  const trails = await trailsFor(files.map((file) => file.folder), scope)

  return {
    query,
    // Said out loud, because a list that stops at fifty looks exactly like a
    // list that found fifty.
    truncated: files.length === RESULTS,
    files: files.map((file) => ({
      ...fileRow(file, file.folder, shares),
      folderId: file.folderId,
      trail: trails.get(file.folderId) ?? [],
    })),
  }
}

/** Prisma parameterises the value but leaves LIKE's own wildcards in it. */
function escapeForLike(query: string) {
  return query.replace(/[\\%_]/g, (character) => `\\${character}`)
}

function reachable(scope: ReadScope) {
  return [
    ...scope.paths.map((path) => ({ folder: { path: { startsWith: path } } })),
    ...(scope.fileIds.length > 0 ? [{ id: { in: scope.fileIds } }] : []),
  ]
}

/**
 * Where each result sits, named. Clipped at the reader's grant the way the
 * breadcrumbs are, and empty for a file shared on its own, whose folder they
 * were never given and whose ancestors they have no business reading.
 */
async function trailsFor(folders: Folder[], scope: ReadScope | null) {
  const ids = [...new Set(folders.flatMap((folder) => segments(folder.path)))]
  const rows = await prisma.folder.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, path: true },
  })
  const byId = new Map(rows.map((row) => [row.id, row]))

  const trails = new Map<string, { id: string; name: string }[]>()
  for (const folder of folders) {
    const full = segments(folder.path).flatMap((id) => {
      const row = byId.get(id)
      return row ? [row] : []
    })
    const start = scope === null ? 0 : full.findIndex((row) => scope.paths.includes(row.path))
    const visible = scope !== null && start < 0 ? [] : full.slice(Math.max(start, 0))
    trails.set(
      folder.id,
      visible.map(({ id, name }) => ({ id, name })),
    )
  }
  return trails
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
