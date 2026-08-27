import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildApp } from '../src/app.js'

/**
 * The same Fastify app, served as one serverless function instead of a process
 * that listens. Built once per cold start and reused for every request the
 * instance handles afterwards.
 */
const started = buildApp().then(async (app) => {
  await app.ready()
  return app
})

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const app = await started
  app.server.emit('request', request, response)
}
