import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

// One .env at the repo root serves both apps. In production nothing is read from
// disk: the file is absent and the platform supplies the variables.
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),

  DATABASE_URL: z.string().min(1),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
  throw new Error(`Environment is incomplete: ${missing}. Copy .env.example and fill it in.`)
}

export const env = parsed.data
