import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { viewerOf } from '../auth.js'
import { newId, prisma, withUniqueName } from '../db.js'
import { cleanName } from '../domain/names.js'
import { childPath } from '../domain/path.js'
import { badRequest } from '../errors.js'
import { openFolder, requireOwner, sharesInSubtree } from '../permissions.js'
import { removeObjects } from '../storage.js'
import { folderView } from '../views.js'

const folderId = z.object({ id: z.uuid() })
const listing = z.object({
  page: z.coerce.number().int().min(1).default(1),
  modified: z.enum(['any', 'today', 'week', 'month', 'year']).default('any'),
})

export const folderRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/folders/:id',
    { schema: { params: folderId, querystring: listing } },
    async (request) =>
      folderView(viewerOf(request), request.params.id, request.query.page, request.query.modified),
  )

  app.post(
    '/folders',
    { schema: { body: z.object({ parentId: z.uuid(), name: z.string() }) } },
    async (request, reply) => {
      const { folder: parent, room, grant } = await openFolder(viewerOf(request), request.body.parentId)
      requireOwner(grant)

      const name = cleanName(request.body.name)
      const id = newId()
      const folder = await withUniqueName('folder', name, () =>
        prisma.folder.create({
          data: {
            id,
            dataRoomId: room.id,
            parentId: parent.id,
            name,
            path: childPath(parent.path, id),
            depth: parent.depth + 1,
          },
        }),
      )

      return reply.status(201).send({ id: folder.id, name: folder.name, parentId: parent.id })
    },
  )

  /**
   * What a delete would take with it. The dialog puts these numbers in front of
   * the reader, because a folder in a data room is rarely as small as it looks
   * and the deletion cascades.
   */
  app.get('/folders/:id/manifest', { schema: { params: folderId } }, async (request) => {
    const { folder, room, grant } = await openFolder(viewerOf(request), request.params.id)
    requireOwner(grant)

    const [folders, files, shares] = await Promise.all([
      prisma.folder.count({ where: { path: { startsWith: folder.path } } }),
      prisma.file.aggregate({
        where: { folder: { path: { startsWith: folder.path } } },
        _count: { _all: true },
        _sum: { sizeBytes: true },
      }),
      sharesInSubtree(room.id, folder.path),
    ])

    return {
      // The prefix scan counts the folder itself; the reader cares about the rest.
      folders: folders - 1,
      files: files._count._all,
      bytes: Number(files._sum.sizeBytes ?? 0),
      shares: shares.length,
    }
  })

  app.patch(
    '/folders/:id',
    {
      schema: {
        params: folderId,
        body: z.object({ name: z.string().optional(), parentId: z.uuid().optional() }),
      },
    },
    async (request) => {
      const viewer = viewerOf(request)
      const { folder, room, grant } = await openFolder(viewer, request.params.id)
      requireOwner(grant)

      if (folder.parentId === null) {
        throw badRequest('The top folder belongs to the data room. Rename or delete the room instead.')
      }

      const name = request.body.name === undefined ? undefined : cleanName(request.body.name)

      if (request.body.parentId === undefined) {
        // Paths are built from ids, so a rename touches one row and nothing else.
        const renamed = await withUniqueName('folder', name ?? folder.name, () =>
          prisma.folder.update({ where: { id: folder.id }, data: { name } }),
        )
        return { id: renamed.id, name: renamed.name, parentId: renamed.parentId }
      }

      const parentId = request.body.parentId

      // Two moves running at once could each pass their own cycle check and then
      // hang the tree off itself. Moves are rare, so one advisory lock per room
      // for the length of the transaction is cheaper than reasoning about it.
      const parent = await withUniqueName('folder', name ?? folder.name, () =>
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${room.id}, 0))`

          const [current, destination] = await Promise.all([
            tx.folder.findUniqueOrThrow({ where: { id: folder.id } }),
            tx.folder.findUnique({ where: { id: parentId } }),
          ])

          if (!destination || destination.dataRoomId !== room.id) {
            throw badRequest('A folder can only move inside its own data room')
          }
          if (destination.path.startsWith(current.path)) {
            throw badRequest('A folder cannot be moved into itself')
          }

          const from = current.path
          const to = childPath(destination.path, current.id)
          const depthChange = destination.depth + 1 - current.depth

          await tx.folder.update({
            where: { id: current.id },
            data: { name, parentId: destination.id },
          })

          // The subtree moves by rewriting one prefix. Every descendant is already
          // selected by that same prefix, so this is a single scan.
          await tx.$executeRaw`
            update folders
               set path = ${to} || substring(path from length(${from}) + 1),
                   depth = depth + ${depthChange}::int
             where path like ${`${from}%`}
          `

          // Shares point at paths too. Leaving them behind would quietly cut off
          // everyone who had been given the folder before it moved.
          await tx.$executeRaw`
            update shares
               set resource_path = ${to} || substring(resource_path from length(${from}) + 1)
             where data_room_id = ${room.id}::uuid
               and resource_path like ${`${from}%`}
          `

          return destination
        }),
      )

      return { id: folder.id, name: name ?? folder.name, parentId: parent.id }
    },
  )

  app.delete('/folders/:id', { schema: { params: folderId } }, async (request, reply) => {
    const { folder, room, grant } = await openFolder(viewerOf(request), request.params.id)
    requireOwner(grant)

    if (folder.parentId === null) {
      throw badRequest('The top folder belongs to the data room. Delete the room instead.')
    }

    const doomed = await prisma.$transaction(async (tx) => {
      // The same lock a move takes. Without it a share created between working
      // out what to revoke and deleting the folder survives, pointing at nothing.
      await tx.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${room.id}, 0))`

      const files = await tx.file.findMany({
        where: { folder: { path: { startsWith: folder.path } } },
        // Every version too: they are the same documents, and once the folder is
        // gone there is no row left pointing at them.
        select: { id: true, storageKey: true, versions: { select: { storageKey: true } } },
      })

      // Revoked rather than deleted: whoever holds a link to something in here
      // gets told it was switched off instead of walking into a blank 404. File
      // shares carry no path, so they are matched through the files themselves.
      await tx.share.updateMany({
        where: {
          dataRoomId: room.id,
          revokedAt: null,
          OR: [
            { resourcePath: { startsWith: folder.path } },
            { resourceType: 'file', resourceId: { in: files.map((file) => file.id) } },
          ],
        },
        data: { revokedAt: new Date() },
      })

      await tx.folder.delete({ where: { id: folder.id } })
      return files
    })

    const keys = [
      ...new Set(
        doomed.flatMap((file) => [file.storageKey, ...file.versions.map((v) => v.storageKey)]),
      ),
    ]

    await removeObjects(keys).catch((error: unknown) => {
      request.log.error({ err: error, folderId: folder.id }, 'folder deleted, objects left behind')
    })

    return reply.status(204).send()
  })
}
