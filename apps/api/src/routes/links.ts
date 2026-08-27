import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { openFile, openLink, openRoom } from '../permissions.js'
import { signDownload } from '../storage.js'
import { folderView } from '../views.js'

const byToken = z.object({ token: z.string().min(1) })

/**
 * What the holder of a public link can do, and nothing besides. These are the only
 * routes that answer without a signed-in account, so they all start by turning the
 * token into a viewer and then go through the same access code as everyone else.
 */
export const linkRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/links/:token', { schema: { params: byToken } }, async (request) => {
    const { share, room, viewer } = await openLink(request.params.token)

    if (share.resourceType === 'file') {
      const { file } = await openFile(viewer, share.resourceId)
      return {
        room: { id: room.id, name: room.name },
        kind: 'file' as const,
        folderId: null,
        file: {
          id: file.id,
          name: file.name,
          sizeBytes: Number(file.sizeBytes),
          mimeType: file.mimeType,
        },
      }
    }

    // A room is shared through its root folder, so both cases end up opening a
    // folder and the browser has one thing to render.
    const folderId =
      share.resourceType === 'data_room'
        ? (await openRoom(viewer, share.resourceId)).root.id
        : share.resourceId

    return {
      room: { id: room.id, name: room.name },
      kind: 'folder' as const,
      folderId,
      file: null,
    }
  })

  app.get(
    '/links/:token/folders/:id',
    { schema: { params: byToken.extend({ id: z.uuid() }) } },
    async (request) => {
      const { viewer } = await openLink(request.params.token)
      return folderView(viewer, request.params.id)
    },
  )

  app.get(
    '/links/:token/files/:id/download-url',
    {
      schema: {
        params: byToken.extend({ id: z.uuid() }),
        querystring: z.object({ disposition: z.enum(['inline', 'attachment']).default('inline') }),
      },
    },
    async (request) => {
      const { viewer } = await openLink(request.params.token)
      const { file } = await openFile(viewer, request.params.id)
      const link = await signDownload(
        file.storageKey,
        file.name,
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
}
