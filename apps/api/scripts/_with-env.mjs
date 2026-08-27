import { config } from 'dotenv'
import { spawnSync } from 'node:child_process'
config({ path: '../../.env' })
const r = spawnSync('npx', process.argv.slice(2), { stdio: 'inherit', shell: true })
process.exit(r.status ?? 1)
