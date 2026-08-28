/**
 * The Prisma CLI with the repo's environment loaded.
 *
 * One .env at the root serves both apps, and the CLI only looks in the directory
 * it runs from, which is this one. Without this, `npm run migrate` fails with
 * "Environment variable not found: DATABASE_URL" on a correctly set up checkout.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(here, '../../../.env') })

// The CLI is resolved rather than called by name: the install hook that runs
// `generate` does not get node_modules/.bin on its PATH, and "prisma is not
// recognized" is a poor way to learn that a fresh checkout has no client yet.
const require = createRequire(import.meta.url)
const manifest = require('prisma/package.json')
const cli = resolve(dirname(require.resolve('prisma/package.json')), manifest.bin.prisma)

// The schema is named outright for the same reason: the CLI looks in the
// directory it was started from, and the install hook starts it at the root.
const args = process.argv.slice(2)
if (!args.includes('--schema')) args.push('--schema', resolve(here, '../prisma/schema.prisma'))

const { status } = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit' })
process.exit(status ?? 1)
