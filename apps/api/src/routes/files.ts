import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { viewerOf } from '../auth.js'
import { newId, prisma, withUniqueName } from '../db.js'
import { cleanName, nextFreeName } from '../domain/names.js'
import { badRequest, nameTaken, notFound } from '../errors.js'
import { openFile, openFolder, requireOwner } from '../permissions.js'
import { describeObject, objectKey, removeObjects, signDownload, signUpload } from '../storage.js'

/**
 * Checked when the upload is asked for and again against what storage reports,
 * because the first number is only the client's word for it. The bucket carries
 * the same limit, and that is the one nobody can talk their way around.
 */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / 1024 / 1024

const fileId = z.object({ id: z.uuid() })
const inFolder = z.object({ folderId: z.uuid() })

const tooLarge = () =>
  badRequest(`Files are limited to ${MAX_UPLOAD_MB} MB`, { limitBytes: MAX_UPLOAD_BYTES })

export const fileRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Step one of an upload: settle on a name and hand back a URL that points
   * straight at storage. Nothing is written to the database yet, so an upload
   * the reader walks away from leaves no half a file behind.
   */
  app.post(
    '/folders/:folderId/uploads',
    {
      schema: {
        params: inFolder,
        body: z.object({
          name: z.string(),
          sizeBytes: z.number().int().nonnegative(),
          onConflict: z.enum(['fail', 'rename', 'replace']).default('fail'),
        }),
      },
    },
    async (request) => {
      const { folder, room, grant } = await openFolder(viewerOf(request), request.params.folderId)
      requireOwner(grant)

      const name = cleanName(request.body.name)
      if (request.body.sizeBytes > MAX_UPLOAD_BYTES) throw tooLarge()

      const existing = await prisma.file.findUnique({
        where: { folderId_name: { folderId: folder.id, name } },
      })

      let id = newId()
      let finalName = name
      let replace = false

      if (existing) {
        if (request.body.onConflict === 'fail') throw nameTaken('file', name)
        if (request.body.onConflict === 'replace') {
          // Same row, same object key: the new bytes land on top of the old ones
          // and every link that pointed at this file still points at it.
          id = existing.id
          replace = true
        } else {
          const siblings = await prisma.file.findMany({
            where: { folderId: folder.id },
            select: { name: true },
          })
          finalName = nextFreeName(name, new Set(siblings.map((file) => file.name)))
        }
      }

      const key = objectKey(room.id, id)
      const { url, token } = await signUpload(key, replace)
      return { fileId: id, name: finalName, url, token, key }
    },
  )

  /**
   * Step two: the bytes are in storage, record the file. Size and type come from
   * storage rather than from the request, so the listing describes what is
   * actually there.
   */
  app.post(
    '/folders/:folderId/files',
    {
      schema: {
        params: inFolder,
        body: z.object({ fileId: z.uuid(), name: z.string() }),
      },
    },
    async (request, reply) => {
      const { folder, room, grant } = await openFolder(viewerOf(request), request.params.folderId)
      requireOwner(grant)

      const name = cleanName(request.body.name)
      const key = objectKey(room.id, request.body.fileId)

      const object = await describeObject(key)
      if (!object) throw badRequest('That upload did not finish')
      if (object.sizeBytes > MAX_UPLOAD_BYTES) {
        await removeObjects([key])
        throw tooLarge()
      }

      // The key is built from a room the caller may write to, so a borrowed id
      // cannot reach another room. This covers the case that is left: an id that
      // already names a file elsewhere in the same room.
      const existing = await prisma.file.findUnique({ where: { id: request.body.fileId } })
      if (existing && existing.folderId !== folder.id) throw notFound('file')

      const recorded = {
        name,
        sizeBytes: BigInt(object.sizeBytes),
        mimeType: object.mimeType,
      }

      const file = await withUniqueName('file', name, () =>
        prisma.file.upsert({
          where: { id: request.body.fileId },
          create: {
            id: request.body.fileId,
            dataRoomId: room.id,
            folderId: folder.id,
            storageKey: key,
            ...recorded,
          },
          update: recorded,
        }),
      )

      return reply.status(201).send({
        id: file.id,
        name: file.name,
        sizeBytes: Number(file.sizeBytes),
        mimeType: file.mimeType,
      })
    },
  )

  app.get(
    '/files/:id/download-url',
    {
      schema: {
        params: fileId,
        querystring: z.object({ disposition: z.enum(['inline', 'attachment']).default('inline') }),
      },
    },
    async (request) => {
      const { file } = await openFile(viewerOf(request), request.params.id)
      const link = await signDownload(
        file.storageKey,
        file.name,
        file.mimeType,
        request.query.disposition === 'attachment',
      )

      return {
        url: link.url,
        expiresIn: link.expiresIn,
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: Number(file.sizeBytes),
      }
    },
  )

  app.patch(
    '/files/:id',
    {
      schema: {
        params: fileId,
        body: z.object({ name: z.string().optional(), folderId: z.uuid().optional() }),
      },
    },
    async (request) => {
      const viewer = viewerOf(request)
      const { file, room, grant } = await openFile(viewer, request.params.id)
      requireOwner(grant)

      const name = request.body.name === undefined ? undefined : cleanName(request.body.name)

      if (request.body.folderId !== undefined) {
        const destination = await openFolder(viewer, request.body.folderId)
        requireOwner(destination.grant)
        if (destination.room.id !== room.id) {
          throw badRequest('A file can only move inside its own data room')
        }
      }

      // The object key is built from ids alone, so neither a rename nor a move
      // touches storage.
      const moved = await withUniqueName('file', name ?? file.name, () =>
        prisma.file.update({
          where: { id: file.id },
          data: { name, folderId: request.body.folderId },
        }),
      )

      return { id: moved.id, name: moved.name, folderId: moved.folderId }
    },
  )

  app.delete('/files/:id', { schema: { params: fileId } }, async (request, reply) => {
    const { file, grant } = await openFile(viewerOf(request), request.params.id)
    requireOwner(grant)

    await prisma.$transaction([
      // Revoked rather than deleted, so a link to this file says it was switched
      // off instead of dropping the reader into a blank 404.
      prisma.share.updateMany({
        where: { resourceType: 'file', resourceId: file.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.file.delete({ where: { id: file.id } }),
    ])

    await removeObjects([file.storageKey]).catch((error: unknown) => {
      request.log.error({ err: error, fileId: file.id }, 'file deleted, object left behind')
    })

    return reply.status(204).send()
  })
}
