import { buildApp } from './app.js'
import { env } from './env.js'

const app = await buildApp()

// 0.0.0.0 rather than localhost so the same entry point works inside a container.
await app.listen({ port: env.PORT, host: '0.0.0.0' })
