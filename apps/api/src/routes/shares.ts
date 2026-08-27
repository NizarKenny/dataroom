import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { principalOf, viewerOf } from '../auth.js'
import { newId, prisma } from '../db.js'
import { isInherited, shareCovers } from '../domain/access.js'
import { badRequest, notFound } from '../errors.js'
import {
  fileTarget,
  folderTarget,
  openFile,
  openFolder,
  openRoom,
  requireOwner,
  toLiveShare,
  type Viewer,
} from '../permissions.js'

const resourceRef = z.object({
  resourceType: z.enum(['data_room', 'folder', 'file']),
  resourceId: z.uuid(),
})

/** 32 characters of base64url. Guessing one is not a thing anybody is going to do. */
const newToken = () => randomBytes(24).toString('base64url')

export const shareRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Who can reach this node, and through what. Shares granted higher up come back
   * marked inherited, because revoking one of those affects a whole branch and the
   * dialog has to say so rather than offer a button that quietly does more.
   */
  app.get('/shares', { schema: { querystring: resourceRef } }, async (request) => {
    const { room, target, grant } = await resolve(viewerOf(request), request.query)
    requireOwner(grant)

    const rows = await prisma.share.findMany({
      where: { dataRoomId: room.id, revokedAt: null },
      include: { grantee: { select: { email: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return rows
      .filter((row) => shareCovers(toLiveShare(row), target))
      .map((row) => ({
        id: row.id,
        mode: row.mode,
        role: row.role,
        token: row.token,
        email: row.grantee?.email ?? row.granteeEmail,
        createdAt: row.createdAt,
        inherited: isInherited(target, toLiveShare(row)),
        resourceType: row.resourceType,
        resourceId: row.resourceId,
      }))
  })

  app.post(
    '/shares',
    {
      schema: {
        body: resourceRef.extend({
          mode: z.enum(['public_link', 'user']),
          email: z.email().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { userId } = principalOf(request)
      const { room, grant, resourcePath } = await resolve(viewerOf(request), request.body)
      requireOwner(grant)

      const base = {
        dataRoomId: room.id,
        resourceType: request.body.resourceType,
        resourceId: request.body.resourceId,
        resourcePath,
        createdById: userId,
      }

      if (request.body.mode === 'public_link') {
        const share = await prisma.share.create({
          data: { id: newId(), ...base, mode: 'public_link', token: newToken() },
        })
        return reply.status(201).send({ id: share.id, mode: share.mode, token: share.token })
      }

      if (!request.body.email) throw badRequest('An invitation needs an email address')
      const email = request.body.email.trim().toLowerCase()

      const owner = await prisma.user.findUnique({ where: { id: room.ownerId } })
      if (owner?.email === email) throw badRequest('You already own this data room')

      // Somebody who has never signed in gets the invitation on their email
      // alone; the account is attached the first time they authenticate.
      const grantee = await prisma.user.findUnique({ where: { email } })

      const already = await prisma.share.findFirst({
        where: {
          dataRoomId: room.id,
          resourceType: base.resourceType,
          resourceId: base.resourceId,
          mode: 'user',
          revokedAt: null,
          OR: [{ granteeEmail: email }, ...(grantee ? [{ granteeUserId: grantee.id }] : [])],
        },
      })
      // Inviting the same person twice is what someone does when they are not
      // sure it went through, and it should not read as an error.
      if (already) {
        return reply.status(200).send({ id: already.id, mode: already.mode, email })
      }

      const share = await prisma.share.create({
        data: {
          id: newId(),
          ...base,
          mode: 'user',
          granteeEmail: email,
          granteeUserId: grantee?.id ?? null,
        },
      })

      return reply.status(201).send({ id: share.id, mode: share.mode, email })
    },
  )

  app.delete(
    '/shares/:id',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request, reply) => {
      const { userId } = principalOf(request)
      const share = await prisma.share.findUnique({
        where: { id: request.params.id },
        include: { dataRoom: { select: { ownerId: true } } },
      })
      if (!share || share.dataRoom.ownerId !== userId) throw notFound('share')

      // Kept as a row with a revoked_at, so the link can say it was switched off
      // and the partial indexes stop considering it either way.
      if (!share.revokedAt) {
        await prisma.share.update({ where: { id: share.id }, data: { revokedAt: new Date() } })
      }

      return reply.status(204).send()
    },
  )
}

/**
 * A share can be granted on a room, a folder or a file, and each of the three
 * needs the same three answers: which room, may the caller do this, and what path
 * does access hang off. A room hangs off its root folder, and a file off nothing.
 */
async function resolve(viewer: Viewer, ref: z.infer<typeof resourceRef>) {
  if (ref.resourceType === 'data_room') {
    const { room, root, grant } = await openRoom(viewer, ref.resourceId)
    return { room, grant, target: folderTarget(root), resourcePath: root.path }
  }

  if (ref.resourceType === 'folder') {
    const { folder, room, grant } = await openFolder(viewer, ref.resourceId)
    return { room, grant, target: folderTarget(folder), resourcePath: folder.path }
  }

  const { file, folder, room, grant } = await openFile(viewer, ref.resourceId)
  return { room, grant, target: fileTarget(file, folder), resourcePath: null }
}
