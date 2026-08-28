import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { principalOf, viewerOf } from '../auth.js'
import { newId, prisma, withUniqueName } from '../db.js'
import { cleanName, nextFreeName, versionedName } from '../domain/names.js'
import { badRequest, nameTaken, notFound, versionRaced } from '../errors.js'
import { openFile, openFolder, requireOwner } from '../permissions.js'
import {
  describeObject,
  isActiveContent,
  objectKey,
  removeObjects,
  signDownload,
  signUpload,
} from '../storage.js'

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

/**
 * A name nothing in that folder is using, so a rejected rename can offer one
 * instead of asking somebody to guess. Read after the write has already failed,
 * so a stale answer costs a second rejection rather than a wrong name.
 */
async function freeFileName(folderId: string, name: string): Promise<string> {
  const siblings = await prisma.file.findMany({ where: { folderId }, select: { name: true } })
  return nextFreeName(name, new Set(siblings.map((file) => file.name)))
}

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
          onConflict: z.enum(['fail', 'rename', 'version']).default('fail'),
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
      let version = 1

      if (existing) {
        if (request.body.onConflict === 'fail') throw nameTaken('file', name)
        if (request.body.onConflict === 'version') {
          // Same row, same id, a key of its own: every link that pointed at this
          // file still points at it, and what was there is still there.
          id = existing.id
          version = existing.version + 1
        } else {
          const siblings = await prisma.file.findMany({
            where: { folderId: folder.id },
            select: { name: true },
          })
          finalName = nextFreeName(name, new Set(siblings.map((file) => file.name)))
        }
      }

      const key = objectKey(room.id, id, version)
      // Nothing is ever written twice to the same key, so there is nothing to
      // overwrite; a retry of the same upload lands on the same key and wins.
      const { url, token } = await signUpload(key, true)
      return { fileId: id, name: finalName, url, token, key, version }
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
        body: z.object({
          fileId: z.uuid(),
          name: z.string(),
          version: z.number().int().min(1).default(1),
        }),
      },
    },
    async (request, reply) => {
      const { folder, room, grant } = await openFolder(viewerOf(request), request.params.folderId)
      requireOwner(grant)

      const { userId } = principalOf(request)
      const name = cleanName(request.body.name)
      const { fileId: id, version } = request.body
      const key = objectKey(room.id, id, version)

      const object = await describeObject(key)
      if (!object) throw badRequest('That upload did not finish')
      if (object.sizeBytes > MAX_UPLOAD_BYTES) {
        await removeObjects([key])
        throw tooLarge()
      }

      // The type on the object is whatever the uploading browser said, and it is
      // served from a host we do not control. A document room has no use for a
      // file the browser would run, so it does not keep one.
      if (isActiveContent(object.mimeType)) {
        await removeObjects([key])
        throw badRequest('This kind of file cannot be stored in a data room', {
          mimeType: object.mimeType,
        })
      }

      // The key is built from a room the caller may write to, so a borrowed id
      // cannot reach another room. This covers the case that is left: an id that
      // already names a file elsewhere in the same room.
      const existing = await prisma.file.findUnique({ where: { id } })
      if (existing && existing.folderId !== folder.id) throw notFound('file')

      // Recording is one step behind an upload that already happened, so it has
      // to survive being run twice: the same version recorded again is the same
      // bytes at the same key, and saying so is better than a 409 for a retry.
      if (existing && version !== existing.version && version !== existing.version + 1) {
        throw versionRaced(existing.name)
      }

      const recorded = {
        name,
        storageKey: key,
        sizeBytes: BigInt(object.sizeBytes),
        mimeType: object.mimeType,
        version,
      }

      const file = await withUniqueName('file', name, () =>
        prisma.$transaction(async (tx) => {
          const saved = await tx.file.upsert({
            where: { id },
            create: { id, dataRoomId: room.id, folderId: folder.id, ...recorded },
            update: recorded,
          })

          await tx.fileVersion.upsert({
            where: { fileId_version: { fileId: id, version } },
            create: {
              id: newId(),
              fileId: id,
              version,
              storageKey: key,
              sizeBytes: recorded.sizeBytes,
              mimeType: recorded.mimeType,
              createdById: userId,
            },
            update: { storageKey: key, sizeBytes: recorded.sizeBytes, mimeType: recorded.mimeType },
          })

          return saved
        }),
      )

      return reply.status(201).send({
        id: file.id,
        name: file.name,
        sizeBytes: Number(file.sizeBytes),
        mimeType: file.mimeType,
        version: file.version,
      })
    },
  )

  /**
   * What this document has been. Owner only: a reader learning that the accounts
   * changed on the fourteenth is a disclosure the seller has not chosen to make,
   * and the room is not the place to make it for them.
   */
  app.get('/files/:id/versions', { schema: { params: fileId } }, async (request) => {
    const { file, grant } = await openFile(viewerOf(request), request.params.id)
    requireOwner(grant)

    const versions = await prisma.fileVersion.findMany({
      where: { fileId: file.id },
      orderBy: { version: 'desc' },
      include: { createdBy: { select: { email: true } } },
    })

    return versions.map((entry) => ({
      version: entry.version,
      sizeBytes: Number(entry.sizeBytes),
      mimeType: entry.mimeType,
      createdAt: entry.createdAt,
      createdBy: entry.createdBy.email,
      current: entry.version === file.version,
    }))
  })

  app.get(
    '/files/:id/versions/:version/download-url',
    {
      schema: {
        params: fileId.extend({ version: z.coerce.number().int().min(1) }),
        querystring: z.object({ disposition: z.enum(['inline', 'attachment']).default('inline') }),
      },
    },
    async (request) => {
      const { file, grant } = await openFile(viewerOf(request), request.params.id)
      requireOwner(grant)

      const entry = await prisma.fileVersion.findUnique({
        where: { fileId_version: { fileId: file.id, version: request.params.version } },
      })
      if (!entry) throw notFound('version')

      // Named for the version, so three of them in a downloads folder are three
      // different files rather than three copies of one.
      const named =
        entry.version === file.version ? file.name : versionedName(file.name, entry.version)

      const link = await signDownload(
        entry.storageKey,
        named,
        entry.mimeType,
        request.query.disposition === 'attachment',
      )
      return { url: link.url, expiresIn: link.expiresIn, name: named, mimeType: entry.mimeType }
    },
  )

  /**
   * Bringing an old version back adds one rather than winding the count down.
   * The history is a record of what happened, and a restore is something that
   * happened; two rows sharing a key is the cheap half of that.
   */
  app.post(
    '/files/:id/versions/:version/restore',
    { schema: { params: fileId.extend({ version: z.coerce.number().int().min(1) }) } },
    async (request) => {
      const { userId } = principalOf(request)
      const { file, grant } = await openFile(viewerOf(request), request.params.id)
      requireOwner(grant)

      if (request.params.version === file.version) {
        throw badRequest('That version is already the current one')
      }

      const restored = await prisma.$transaction(async (tx) => {
        const entry = await tx.fileVersion.findUnique({
          where: { fileId_version: { fileId: file.id, version: request.params.version } },
        })
        if (!entry) throw notFound('version')

        const next = file.version + 1
        await tx.fileVersion.create({
          data: {
            id: newId(),
            fileId: file.id,
            version: next,
            storageKey: entry.storageKey,
            sizeBytes: entry.sizeBytes,
            mimeType: entry.mimeType,
            createdById: userId,
          },
        })

        return tx.file.update({
          where: { id: file.id },
          data: {
            storageKey: entry.storageKey,
            sizeBytes: entry.sizeBytes,
            mimeType: entry.mimeType,
            version: next,
          },
        })
      })

      return { id: restored.id, name: restored.name, version: restored.version }
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
      const landing = request.body.folderId ?? file.folderId
      const moved = await withUniqueName(
        'file',
        name ?? file.name,
        () =>
          prisma.file.update({
            where: { id: file.id },
            data: { name, folderId: request.body.folderId },
          }),
        () => freeFileName(landing, name ?? file.name),
      )

      return { id: moved.id, name: moved.name, folderId: moved.folderId }
    },
  )

  app.delete('/files/:id', { schema: { params: fileId } }, async (request, reply) => {
    const { file, grant } = await openFile(viewerOf(request), request.params.id)
    requireOwner(grant)

    const versions = await prisma.fileVersion.findMany({
      where: { fileId: file.id },
      select: { storageKey: true },
    })
    const keys = [...new Set([file.storageKey, ...versions.map((entry) => entry.storageKey)])]

    await prisma.$transaction([
      // Revoked rather than deleted, so a link to this file says it was switched
      // off instead of dropping the reader into a blank 404.
      prisma.share.updateMany({
        where: { resourceType: 'file', resourceId: file.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.file.delete({ where: { id: file.id } }),
    ])

    // Every version, not just the one on the row: the others are the same
    // document and nobody can reach them once the file is gone.
    await removeObjects(keys).catch((error: unknown) => {
      request.log.error({ err: error, fileId: file.id }, 'file deleted, objects left behind')
    })

    return reply.status(204).send()
  })
}
