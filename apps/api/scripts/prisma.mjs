/**
 * The Prisma CLI with the repo's environment loaded.
 *
 * One .env at the root serves both apps, and the CLI only looks in the directory
 * it runs from, which is this one. Without this, `npm run migrate` fails with
 * "Environment variable not found: DATABASE_URL" on a correctly set up checkout.
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

const { status } = spawnSync('prisma', process.argv.slice(2), { stdio: 'inherit', shell: true })
process.exit(status ?? 1)
