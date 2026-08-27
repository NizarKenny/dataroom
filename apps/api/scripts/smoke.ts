/**
 * End to end pass over the API against the real database and the real bucket.
 *
 * The unit tests cover the access rules on their own; this covers the wiring
 * around them, including the things only Postgres and Storage can tell us: the
 * unique indexes, the subtree rewrite on a move, and whether the bytes that come
 * back down are the bytes that went up.
 *
 * It needs a filled in .env, so it is not part of the CI run.
 *   npx tsx scripts/smoke.ts
 */
import { createClient } from '@supabase/supabase-js'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db.js'
import { env } from '../src/env.js'

const PASSWORD = 'smoke-test-password-8712'
const stamp = Date.now()
const OWNER = `smoke-owner-${stamp}@example.com`
const READER = `smoke-reader-${stamp}@example.com`

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let failures = 0

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    console.log(`  ok    ${label}`)
    return
  }
  failures++
  console.log(`  FAIL  ${label}`)
  if (detail !== undefined) console.log(`        ${JSON.stringify(detail)}`)
}

async function signUp(email: string) {
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (created.error || !created.data.user) throw created.error ?? new Error('no user')

  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!anonKey) throw new Error('SUPABASE_PUBLISHABLE_KEY is missing from .env')

  const session = await createClient(env.SUPABASE_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email, password: PASSWORD })
  if (session.error || !session.data.session) throw session.error ?? new Error('no session')

  return { id: created.data.user.id, token: session.data.session.access_token }
}

function caller(app: FastifyInstance, token?: string) {
  return async (method: string, url: string, payload?: unknown) => {
    const response = await app.inject({
      method: method as 'GET',
      url,
      payload: payload as object | undefined,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
    const body = response.body ? JSON.parse(response.body) : null
    return { status: response.statusCode, body }
  }
}

async function main() {
  const owner = await signUp(OWNER)
  const reader = await signUp(READER)

  const app = await buildApp()
  const asOwner = caller(app, owner.token)
  const asReader = caller(app, reader.token)
  const anonymous = caller(app)

  console.log('\nrooms and folders')
  const room = await asOwner('POST', '/rooms', { name: 'Project Atlas' })
  check('a room is created with a root folder', room.status === 201 && !!room.body.rootFolderId, room.body)
  const rootId = room.body.rootFolderId as string
  const roomId = room.body.id as string

  const financials = await asOwner('POST', '/folders', { parentId: rootId, name: 'Financials' })
  const legal = await asOwner('POST', '/folders', { parentId: rootId, name: 'Legal' })
  const q4 = await asOwner('POST', '/folders', { parentId: financials.body.id, name: 'Q4' })
  check('folders nest', q4.status === 201, q4.body)

  const duplicate = await asOwner('POST', '/folders', { parentId: rootId, name: 'Legal' })
  check('a duplicate name is refused by the index', duplicate.status === 409, duplicate.body)

  const badName = await asOwner('POST', '/folders', { parentId: rootId, name: 'Legal/NDA' })
  check('a name with a separator is refused', badName.status === 400, badName.body)

  console.log('\nupload')
  const bytes = Buffer.from('period,revenue\nQ4,1240000\n', 'utf8')
  const ticket = await asOwner('POST', `/folders/${q4.body.id}/uploads`, {
    name: 'cap-table.csv',
    sizeBytes: bytes.byteLength,
  })
  check('an upload is signed', ticket.status === 200 && !!ticket.body.url, ticket.body)

  const put = await fetch(ticket.body.url, {
    method: 'PUT',
    body: bytes,
    headers: { 'content-type': 'text/csv' },
  })
  check('the browser can put bytes straight into storage', put.ok, await put.text())

  const recorded = await asOwner('POST', `/folders/${q4.body.id}/files`, {
    fileId: ticket.body.fileId,
    name: 'cap-table.csv',
  })
  check('the file is recorded', recorded.status === 201, recorded.body)
  check('the size comes from storage, not the request', recorded.body?.sizeBytes === bytes.byteLength, recorded.body)

  const ghost = await asOwner('POST', `/folders/${q4.body.id}/files`, {
    fileId: '01999999-0000-7000-8000-00000000dead',
    name: 'never-uploaded.csv',
  })
  check('a file with no bytes behind it is refused', ghost.status === 400, ghost.body)

  console.log('\nname conflicts')
  const clash = await asOwner('POST', `/folders/${q4.body.id}/uploads`, {
    name: 'cap-table.csv',
    sizeBytes: 10,
  })
  check('a clashing upload fails by default', clash.status === 409, clash.body)

  const renamed = await asOwner('POST', `/folders/${q4.body.id}/uploads`, {
    name: 'cap-table.csv',
    sizeBytes: 10,
    onConflict: 'rename',
  })
  check('keep both numbers the copy', renamed.body?.name === 'cap-table (2).csv', renamed.body)

  const replaced = await asOwner('POST', `/folders/${q4.body.id}/uploads`, {
    name: 'cap-table.csv',
    sizeBytes: 10,
    onConflict: 'replace',
  })
  check('replace reuses the same file', replaced.body?.fileId === ticket.body.fileId, replaced.body)

  console.log('\nlisting')
  const listing = await asOwner('GET', `/folders/${q4.body.id}`)
  check('the folder lists its file', listing.body?.files?.length === 1, listing.body?.files)
  check('breadcrumbs run from the room down', listing.body?.breadcrumbs?.length === 3, listing.body?.breadcrumbs)
  check('the owner sees the access column', listing.body?.files?.[0]?.access !== null)

  console.log('\ndownload')
  const download = await asOwner('GET', `/files/${recorded.body.id}/download-url`)
  const fetched = await fetch(download.body.url)
  check('the bytes that come back are the bytes that went up', (await fetched.text()) === bytes.toString('utf8'))

  console.log('\nsharing with a person')
  const invite = await asOwner('POST', '/shares', {
    resourceType: 'folder',
    resourceId: financials.body.id,
    mode: 'user',
    email: READER,
  })
  check('an invitation is created', invite.status === 201, invite.body)

  const inviteAgain = await asOwner('POST', '/shares', {
    resourceType: 'folder',
    resourceId: financials.body.id,
    mode: 'user',
    email: READER,
  })
  check('inviting twice is not an error', inviteAgain.status === 200 && inviteAgain.body.id === invite.body.id)

  const readerInQ4 = await asReader('GET', `/folders/${q4.body.id}`)
  check('the reader reaches a folder below the one they were given', readerInQ4.status === 200, readerInQ4.body)
  check('their breadcrumbs start at the folder they were given', readerInQ4.body?.breadcrumbs?.length === 2, readerInQ4.body?.breadcrumbs)
  check('they are not told who else has access', readerInQ4.body?.files?.[0]?.access === null)

  // The whole point of the model: one branch shared is one branch shared.
  const readerInLegal = await asReader('GET', `/folders/${legal.body.id}`)
  check('the reader cannot reach a sibling branch', readerInLegal.status === 404, readerInLegal.body)

  const readerWrites = await asReader('POST', '/folders', {
    parentId: q4.body.id,
    name: 'Sneaky',
  })
  check('the reader cannot write', readerWrites.status === 403, readerWrites.body)

  const readerRooms = await asReader('GET', '/rooms')
  check('the room shows up in their list', readerRooms.body?.length === 1, readerRooms.body)
  check('without the totals for the parts they cannot see', readerRooms.body?.[0]?.files === null)

  console.log('\npublic link')
  const link = await asOwner('POST', '/shares', {
    resourceType: 'folder',
    resourceId: q4.body.id,
    mode: 'public_link',
  })
  const token = link.body.token as string
  const opened = await anonymous('GET', `/links/${token}`)
  check('a link opens without an account', opened.status === 200 && opened.body.folderId === q4.body.id, opened.body)

  const linkInQ4 = await anonymous('GET', `/links/${token}/folders/${q4.body.id}`)
  check('the link lists the folder it was made for', linkInQ4.status === 200, linkInQ4.body)

  const linkInLegal = await anonymous('GET', `/links/${token}/folders/${legal.body.id}`)
  check('the link reaches nothing else', linkInLegal.status === 404, linkInLegal.body)

  const fileLink = await asOwner('POST', '/shares', {
    resourceType: 'file',
    resourceId: recorded.body.id,
    mode: 'public_link',
  })
  const openedFile = await anonymous('GET', `/links/${fileLink.body.token}`)
  check('a link to one file opens on that file', openedFile.body?.kind === 'file', openedFile.body)
  check('and names it', openedFile.body?.file?.name === 'cap-table.csv', openedFile.body?.file)

  const fileLinkFolder = await anonymous(
    'GET',
    `/links/${fileLink.body.token}/folders/${q4.body.id}`,
  )
  check('a link to one file does not open its folder', fileLinkFolder.status === 404)

  console.log('\nmoving a subtree')
  const move = await asOwner('PATCH', `/folders/${q4.body.id}`, { parentId: legal.body.id })
  check('the folder moves', move.status === 200, move.body)

  const afterMove = await prisma.folder.findUniqueOrThrow({ where: { id: q4.body.id } })
  check('its path is rebuilt under the new parent', afterMove.path.startsWith(`/${rootId}/${legal.body.id}/`), afterMove.path)
  check('and its depth with it', afterMove.depth === 2, afterMove.depth)

  // The share was granted on the folder that moved, so it has to move with it.
  const linkAfterMove = await anonymous('GET', `/links/${token}/folders/${q4.body.id}`)
  check('a link into the moved folder still works', linkAfterMove.status === 200, linkAfterMove.body)

  const cycle = await asOwner('PATCH', `/folders/${legal.body.id}`, { parentId: q4.body.id })
  check('a folder cannot be moved inside its own subtree', cycle.status === 400, cycle.body)

  // The invitation was on Financials, which Q4 has just left.
  const readerAfterMove = await asReader('GET', `/folders/${q4.body.id}`)
  check('access granted above the folder does not follow it out', readerAfterMove.status === 404)

  console.log('\nrenaming')
  const beforeRename = await prisma.folder.findUniqueOrThrow({ where: { id: financials.body.id } })
  await asOwner('PATCH', `/folders/${financials.body.id}`, { name: 'Finance' })
  const afterRename = await prisma.folder.findUniqueOrThrow({ where: { id: financials.body.id } })
  check('a rename leaves every path alone', beforeRename.path === afterRename.path)
  check('and the name changes', afterRename.name === 'Finance')

  console.log('\nmanifest and delete')
  const manifest = await asOwner('GET', `/folders/${legal.body.id}/manifest`)
  check('the manifest counts the subtree', manifest.body?.folders === 1 && manifest.body?.files === 1, manifest.body)
  // The folder share on Q4 and the file share on the spreadsheet inside it. A
  // file share carries no path, so counting it means resolving it through its file.
  check('and the shares inside it, including one on a file', manifest.body?.shares === 2, manifest.body)

  const root = await asOwner('DELETE', `/folders/${rootId}`)
  check('the top folder cannot be deleted on its own', root.status === 400, root.body)

  await asOwner('DELETE', `/folders/${legal.body.id}`)
  const deadLink = await anonymous('GET', `/links/${token}`)
  check('a link into a deleted folder says it was switched off', deadLink.status === 403, deadLink.body)

  const leftBehind = await prisma.file.count({ where: { dataRoomId: roomId } })
  check('the files went with it', leftBehind === 0, leftBehind)

  console.log('\nrevoking')
  const revoke = await asOwner('DELETE', `/shares/${invite.body.id}`)
  check('the invitation is revoked', revoke.status === 204)
  const afterRevoke = await asReader('GET', `/folders/${rootId}`)
  check('and the reader is out', afterRevoke.status === 404)

  // A folder keeps its shares as revoked rows. A room takes them with it, so a
  // link into a deleted room has nothing left to answer for it.
  const roomLink = await asOwner('POST', '/shares', {
    resourceType: 'data_room',
    resourceId: roomId,
    mode: 'public_link',
  })

  await asOwner('DELETE', `/rooms/${roomId}`)
  const gone = await asOwner('GET', `/rooms/${roomId}`)
  check('the room is gone', gone.status === 404)

  const afterRoom = await anonymous('GET', `/links/${roomLink.body.token}`)
  check('and a link into it answers 404, not revoked', afterRoom.status === 404, afterRoom.body)

  await app.close()
}

async function cleanUp() {
  for (const email of [OWNER, READER]) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      await prisma.user.delete({ where: { id: user.id } })
      await admin.auth.admin.deleteUser(user.id)
    }
  }
  await prisma.$disconnect()
}

try {
  await main()
} finally {
  await cleanUp()
}

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} checks failed`)
process.exit(failures === 0 ? 0 : 1)
