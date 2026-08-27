import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { principalOf, viewerOf } from '../auth.js'
import { newId, prisma } from '../db.js'
import { cleanName } from '../domain/names.js'
import { rootPath, segments } from '../domain/path.js'
import { openRoom, requireOwner } from '../permissions.js'
import { listRoomObjects, removeObjects } from '../storage.js'

const roomId = z.object({ id: z.uuid() })

interface Invitation {
  resourceId: string
  resourcePath: string | null
}

/**
 * The shallowest folder this reader was given, since that is the most of the room
 * they can see at once. A share of a single file has no folder to open, so the
 * room opens on the file itself.
 */
function entryFor(invitations: Invitation[]) {
  const folders = invitations.filter((share) => share.resourcePath !== null)
  if (folders.length === 0) {
    return { kind: 'file' as const, id: invitations[0]?.resourceId ?? null }
  }

  const shallowest = folders.reduce((best, share) =>
    (share.resourcePath ?? '').length < (best.resourcePath ?? '').length ? share : best,
  )
  return { kind: 'folder' as const, id: segments(shallowest.resourcePath ?? '').at(-1) ?? null }
}
const roomName = z.object({ name: z.string() })

export const roomRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/rooms', async (request) => {
    const { userId } = principalOf(request)

    const invitations = await prisma.share.findMany({
      where: { granteeUserId: userId, revokedAt: null },
      select: { dataRoomId: true, resourceId: true, resourcePath: true },
    })

    const rooms = await prisma.dataRoom.findMany({
      where: {
        OR: [{ ownerId: userId }, { id: { in: invitations.map((row) => row.dataRoomId) } }],
      },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { files: true } },
        folders: { where: { parentId: null }, select: { id: true } },
      },
    })

    const sizes = await prisma.file.groupBy({
      by: ['dataRoomId'],
      where: { dataRoomId: { in: rooms.map((room) => room.id) } },
      _sum: { sizeBytes: true },
    })
    const bytesIn = new Map(sizes.map((row) => [row.dataRoomId, Number(row._sum.sizeBytes ?? 0)]))

    return rooms.map((room) => {
      const owned = room.ownerId === userId
      return {
        id: room.id,
        name: room.name,
        role: owned ? 'owner' : 'viewer',
        // Where opening this room lands. An owner starts at the root; a reader
        // starts where they were let in, because the root would answer 404.
        entry: owned
          ? { kind: 'folder' as const, id: room.folders[0]?.id ?? null }
          : entryFor(invitations.filter((share) => share.dataRoomId === room.id)),
        updatedAt: room.updatedAt,
        // Totals describe the whole room, and someone invited into one folder
        // must not learn how much sits outside it.
        files: owned ? room._count.files : null,
        bytes: owned ? (bytesIn.get(room.id) ?? 0) : null,
      }
    })
  })

  app.post('/rooms', { schema: { body: roomName } }, async (request, reply) => {
    const { userId } = principalOf(request)
    const name = cleanName(request.body.name)

    // Every room gets a root folder straight away, so a share of the room and a
    // share of a folder are the same row shape and access has one code path.
    const folderId = newId()
    const room = await prisma.dataRoom.create({
      data: {
        id: newId(),
        ownerId: userId,
        name,
        folders: { create: { id: folderId, name, path: rootPath(folderId), depth: 0 } },
      },
    })

    return reply.status(201).send({ id: room.id, name: room.name, rootFolderId: folderId })
  })

  app.get('/rooms/:id', { schema: { params: roomId } }, async (request) => {
    const { room, root, grant } = await openRoom(viewerOf(request), request.params.id)
    return { id: room.id, name: room.name, role: grant.role, rootFolderId: root.id }
  })

  /**
   * Every folder in the room, flat. The move dialog needs the whole tree to draw
   * a destination, and a room's folder count is small enough that paging it would
   * cost more than it saves.
   */
  app.get('/rooms/:id/folders', { schema: { params: roomId } }, async (request) => {
    const { room, grant } = await openRoom(viewerOf(request), request.params.id)
    requireOwner(grant)

    const folders = await prisma.folder.findMany({
      where: { dataRoomId: room.id },
      select: { id: true, name: true, parentId: true, depth: true },
      orderBy: [{ depth: 'asc' }, { name: 'asc' }],
    })

    return folders
  })

  app.patch('/rooms/:id', { schema: { params: roomId, body: roomName } }, async (request) => {
    const { room, root, grant } = await openRoom(viewerOf(request), request.params.id)
    requireOwner(grant)

    // The root folder carries the room's name in breadcrumbs, so the two move together.
    const name = cleanName(request.body.name)
    await prisma.$transaction([
      prisma.dataRoom.update({ where: { id: room.id }, data: { name } }),
      prisma.folder.update({ where: { id: root.id }, data: { name } }),
    ])

    return { id: room.id, name }
  })

  app.delete('/rooms/:id', { schema: { params: roomId } }, async (request, reply) => {
    const { room, grant } = await openRoom(viewerOf(request), request.params.id)
    requireOwner(grant)

    const keys = await listRoomObjects(room.id)
    // Rows first: they are what the room is. A blob that outlives them is
    // unreachable rather than dangerous, and it is worth a log rather than a 500.
    await prisma.dataRoom.delete({ where: { id: room.id } })
    await removeObjects(keys).catch((error: unknown) => {
      request.log.error({ err: error, roomId: room.id }, 'data room deleted, objects left behind')
    })

    return reply.status(204).send()
  })
}
