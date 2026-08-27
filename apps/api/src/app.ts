import cors from '@fastify/cors'
import { Prisma } from '@prisma/client'
import Fastify, { type FastifyInstance } from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { authenticate } from './auth.js'
import { env } from './env.js'
import { AppError, notFound } from './errors.js'
import { fileRoutes } from './routes/files.js'
import { folderRoutes } from './routes/folders.js'
import { linkRoutes } from './routes/links.js'
import { roomRoutes } from './routes/rooms.js'
import { shareRoutes } from './routes/shares.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Preview deployments each get their own hostname, so the origin is a list.
  await app.register(cors, {
    origin: env.WEB_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: true,
  })

  app.decorateRequest('principal', null)

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.status)
        .send({ error: error.code, message: error.message, detail: error.detail })
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: 'bad_request',
        message: 'That request did not look right',
        detail: {
          issues: error.validation.map((issue) => ({
            at: issue.instancePath,
            message: issue.message,
          })),
        },
      })
    }

    // Two Prisma failures mean the same thing to a caller: the row they named
    // stopped existing between the check and the write. Anything else from
    // Prisma is a bug of ours, not theirs.
    const vanished =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2003' || error.code === 'P2025')

    if (vanished) {
      const gone = notFound()
      return reply.status(gone.status).send({ error: gone.code, message: gone.message })
    }

    // Anything unrecognised is ours to fix, and the caller learns nothing from it.
    request.log.error({ err: error }, 'unhandled error')
    return reply.status(500).send({ error: 'internal', message: 'Something went wrong on our side' })
  })

  app.get('/health', async () => ({ ok: true }))

  await app.register(linkRoutes)

  await app.register(async (signedIn) => {
    signedIn.addHook('preHandler', authenticate)
    await signedIn.register(roomRoutes)
    await signedIn.register(folderRoutes)
    await signedIn.register(fileRoutes)
    await signedIn.register(shareRoutes)
  })

  return app
}
