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
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      serializers: {
        // A public link's token is a path segment, and it works on its own. The
        // default serializer would write it into every request log.
        req: (request) => ({
          method: request.method,
          url: request.url.replace(/^\/links\/[^/?]+/, '/links/[token]'),
        }),
      },
    },
  })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Preview deployments each get their own hostname, so the origin is a list.
  // The methods are spelled out because this plugin defaults to GET, HEAD and
  // POST, and a preflight that omits the rest fails in the browser only: curl
  // and the smoke test never send one, so a rename looks fine from a terminal.
  await app.register(cors, {
    origin: env.WEB_ORIGIN.split(',').map((origin) => origin.trim()),
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  })

  app.decorateRequest('principal', null)

  // The platform's default is `public`, and a corporate proxy between two sides
  // of a deal is entitled to store what that permits. Nothing here is cacheable
  // by anyone but the browser that asked for it.
  app.addHook('onSend', async (_request, reply) => {
    reply.header('cache-control', 'no-store')
  })

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

  // Somebody will paste this host into a browser. In production they get
  // public/index.html, which the platform serves before the rewrite reaches
  // this; locally, and for anything asking for JSON, this is the answer.
  app.get('/', async () => ({
    service: 'data-room-api',
    app: env.WEB_ORIGIN.split(',')[0],
  }))

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
