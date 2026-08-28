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
import { newId, prisma } from '../src/db.js'
import { childPath } from '../src/domain/path.js'
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

  // The browser is the only client that sends a preflight, so a method missing
  // from the allow list breaks rename, move and every delete in production while
  // curl and every call in this file keep passing.
  console.log('\ncors preflight')
  const preflight = await app.inject({
    method: 'OPTIONS',
    url: '/rooms/00000000-0000-7000-8000-000000000000',
    headers: {
      origin: env.WEB_ORIGIN.split(',')[0]!.trim(),
      'access-control-request-method': 'DELETE',
    },
  })
  const allowed = String(preflight.headers['access-control-allow-methods'] ?? '')
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    check(`preflight allows ${method}`, allowed.includes(method), allowed)
  }

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

  console.log('\nversions')
  const revised = Buffer.from('period,revenue\nQ4,1310000\n', 'utf8')
  const second = await asOwner('POST', `/folders/${q4.body.id}/uploads`, {
    name: 'cap-table.csv',
    sizeBytes: revised.byteLength,
    onConflict: 'version',
  })
  check('a new version keeps the same file', second.body?.fileId === ticket.body.fileId, second.body)
  check('and is numbered two', second.body?.version === 2, second.body)
  check('on a key of its own', second.body?.key !== ticket.body.key, second.body)

  await fetch(second.body.url, {
    method: 'PUT',
    body: revised,
    headers: { 'content-type': 'text/csv' },
  })
  const recordedTwo = await asOwner('POST', `/folders/${q4.body.id}/files`, {
    fileId: second.body.fileId,
    name: 'cap-table.csv',
    version: 2,
  })
  check('the file is now at version two', recordedTwo.body?.version === 2, recordedTwo.body)

  const again = await asOwner('POST', `/folders/${q4.body.id}/files`, {
    fileId: second.body.fileId,
    name: 'cap-table.csv',
    version: 2,
  })
  check('recording the same version twice is not an error', again.status === 201, again.body)

  const history = await asOwner('GET', `/files/${ticket.body.fileId}/versions`)
  check('both versions are listed', history.body?.length === 2, history.body)
  check('the newest is current', history.body?.[0]?.current === true, history.body)

  const old1 = await asOwner('GET', `/files/${ticket.body.fileId}/versions/1/download-url`)
  const oldBytes = await fetch(old1.body.url)
  check('version one still holds the bytes it always did', (await oldBytes.text()) === bytes.toString('utf8'))
  check('and downloads under its own name', old1.body?.name === 'cap-table (v1).csv', old1.body)

  const restored = await asOwner('POST', `/files/${ticket.body.fileId}/versions/1/restore`)
  check('restoring counts up rather than down', restored.body?.version === 3, restored.body)
  const current = await asOwner('GET', `/files/${ticket.body.fileId}/download-url`)
  const currentBytes = await fetch(current.body.url)
  check('and the file reads as version one again', (await currentBytes.text()) === bytes.toString('utf8'))

  console.log('\nlisting')
  const listing = await asOwner('GET', `/folders/${q4.body.id}`)
  check('the folder lists its file', listing.body?.files?.length === 1, listing.body?.files)
  check('breadcrumbs run from the room down', listing.body?.breadcrumbs?.length === 3, listing.body?.breadcrumbs)
  check('the owner sees the access column', listing.body?.files?.[0]?.access !== null)

  // Fifty two rows in one folder, written straight to the database because this
  // is about the read path and fifty two round trips would only be slow.
  const paged = await asOwner('POST', '/folders', { parentId: rootId, name: 'Paging' })
  await prisma.folder.createMany({
    data: Array.from({ length: 52 }, (_, n) => {
      const id = newId()
      return {
        id,
        dataRoomId: roomId,
        parentId: paged.body.id as string,
        name: `Box ${String(n + 1).padStart(2, '0')}`,
        path: childPath(paged.body.path as string, id),
        depth: 2,
      }
    }),
  })

  const first = await asOwner('GET', `/folders/${paged.body.id}`)
  check('a page holds fifty rows', first.body?.folders?.length === 50, first.body?.folders?.length)
  check('and says how many pages there are', first.body?.page?.pages === 2, first.body?.page)
  check('and how many rows in total', first.body?.page?.total === 52, first.body?.page)

  const lastPage = await asOwner('GET', `/folders/${paged.body.id}?page=2`)
  check('the last page holds the remainder', lastPage.body?.folders?.length === 2, lastPage.body?.folders?.length)
  check('and carries on where the first stopped', lastPage.body?.folders?.[0]?.name === 'Box 51', lastPage.body?.folders?.[0])

  const beyond = await asOwner('GET', `/folders/${paged.body.id}?page=99`)
  check('a page past the end lands on the last one', beyond.body?.page?.number === 2, beyond.body?.page)

  const q4Page = await asOwner('GET', `/folders/${q4.body.id}`)
  check('one page of rows still says so', q4Page.body?.page?.pages === 1, q4Page.body?.page)

  // Everything in the room was made minutes ago, so a window of a day keeps it
  // and a filter is only worth trusting if it also throws things away.
  const recent = await asOwner('GET', `/folders/${paged.body.id}?modified=today`)
  check('a filter keeps what falls inside it', recent.body?.page?.total === 52, recent.body?.page)

  await prisma.folder.updateMany({
    where: { parentId: paged.body.id as string },
    data: { updatedAt: new Date('2020-01-01T00:00:00Z') },
  })
  const stale = await asOwner('GET', `/folders/${paged.body.id}?modified=today`)
  check('and drops what falls outside it', stale.body?.page?.total === 0, stale.body?.page)
  check('the pager collapses with it', stale.body?.page?.pages === 1, stale.body?.page)
  const unfiltered = await asOwner('GET', `/folders/${paged.body.id}`)
  check('with the filter off they are all back', unfiltered.body?.page?.total === 52, unfiltered.body?.page)

  // Sorting has to happen in the database: the biggest file on this page is not
  // the biggest file in the folder, and a pager makes that difference visible.
  const byNameDown = await asOwner('GET', `/folders/${paged.body.id}?sort=name&dir=desc`)
  check('a listing sorts by name backwards', byNameDown.body?.folders?.[0]?.name === 'Box 52', byNameDown.body?.folders?.[0])

  const bigFirst = await asOwner('GET', `/folders/${q4.body.id}?sort=size&dir=desc`)
  const smallFirst = await asOwner('GET', `/folders/${q4.body.id}?sort=size&dir=asc`)
  check('and by size, biggest first', bigFirst.body?.files?.[0]?.sizeBytes >= bigFirst.body?.files?.at(-1)?.sizeBytes, bigFirst.body?.files)
  check('and smallest first the other way', smallFirst.body?.files?.[0]?.sizeBytes <= smallFirst.body?.files?.at(-1)?.sizeBytes, smallFirst.body?.files)
  check('which is the reverse of the same list', smallFirst.body?.files?.[0]?.id === bigFirst.body?.files?.at(-1)?.id, {
    small: smallFirst.body?.files?.[0]?.name,
    big: bigFirst.body?.files?.at(-1)?.name,
  })

  // Folders have no size, so they hold their block and fall back to their names.
  const mixed = await asOwner('GET', `/folders/${rootId}?sort=size&dir=desc`)
  const folderNames = (mixed.body?.folders ?? []).map((folder: { name: string }) => folder.name)
  check(
    'folders fall back to their names when the sort is by size',
    folderNames.join() === [...folderNames].sort().join(),
    folderNames,
  )

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

  // They can read the document; that a newer one replaced an older one is the
  // seller's to disclose, not the room's to announce.
  const readerHistory = await asReader('GET', `/files/${ticket.body.fileId}/versions`)
  check('a reader who can read the file still cannot read its history', readerHistory.status === 403, readerHistory.status)

  // The whole point of the model: one branch shared is one branch shared.
  const readerInLegal = await asReader('GET', `/folders/${legal.body.id}`)
  check('the reader cannot reach a sibling branch', readerInLegal.status === 404, readerInLegal.body)

  console.log('\nsearch')
  const found = await asOwner('GET', `/rooms/${roomId}/search?q=cap-table`)
  check('the owner finds a file anywhere in the room', found.body?.files?.length === 1, found.body)
  check('and is told where it sits', found.body?.files?.[0]?.trail?.length === 3, found.body?.files?.[0])

  const wildcard = await asOwner('GET', `/rooms/${roomId}/search?q=%25`)
  check('a percent sign is a character, not a wildcard', wildcard.body?.files?.length === 0, wildcard.body)

  const readerFound = await asReader('GET', `/rooms/${roomId}/search?q=cap-table`)
  check('a reader searches too', readerFound.body?.files?.length === 1, readerFound.body)
  check('and their trail starts at their own grant', readerFound.body?.files?.[0]?.trail?.length === 2, readerFound.body?.files?.[0])

  const readerMisses = await asReader('GET', `/rooms/${roomId}/search?q=nda`)
  check('and finds nothing outside it', readerMisses.body?.files?.length === 0, readerMisses.body)

  // Somebody looking for the legal folder types "legal", and silence reads as
  // broken rather than as a scope.
  const foundFolder = await asOwner('GET', `/rooms/${roomId}/search?q=financ`)
  check('the owner finds a folder by name', foundFolder.body?.folders?.length === 1, foundFolder.body?.folders)
  check('and a folder result stops short of itself', foundFolder.body?.folders?.[0]?.trail?.length === 1, foundFolder.body?.folders?.[0])

  const rootHidden = await asOwner('GET', `/rooms/${roomId}/search?q=Project Atlas`)
  check('the room root is not a search result', rootHidden.body?.folders?.length === 0, rootHidden.body?.folders)

  const readerFolders = await asReader('GET', `/rooms/${roomId}/search?q=q4`)
  check('a reader finds a folder inside their grant', readerFolders.body?.folders?.length === 1, readerFolders.body?.folders)
  const readerBlocked = await asReader('GET', `/rooms/${roomId}/search?q=legal`)
  check('and none outside it', readerBlocked.body?.folders?.length === 0, readerBlocked.body?.folders)

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
