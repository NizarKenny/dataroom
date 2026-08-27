/**
 * The demo room, as a reviewer first sees it.
 *
 * Two accounts, one room laid out the way a real due diligence index is, real
 * documents, and both kinds of sharing already in place so the access rules are
 * visible without having to set anything up:
 *
 *   03 Legal      is shared with the reader account
 *   02 Financials/Q4 2025 has a public link
 *
 * Running it again replaces the room and leaves everything else alone.
 *   npx tsx scripts/seed.ts
 */
import { createClient } from '@supabase/supabase-js'
import { newId, prisma } from '../src/db.js'
import { childPath, rootPath } from '../src/domain/path.js'
import { env } from '../src/env.js'
import { listRoomObjects, objectKey, putObject, removeObjects } from '../src/storage.js'
import { csv, pdf, text } from './samples.js'

const PASSWORD = 'dataroom-demo-2026'
const OWNER = 'demo@dataroom.dev'
const READER = 'reader@dataroom.dev'
const ROOM = 'Project Atlas'

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface Doc {
  name: string
  mimeType: string
  body: Buffer
}

interface Node {
  name: string
  files?: Doc[]
  folders?: Node[]
}

const document = (name: string, title: string, lines: string[]): Doc => ({
  name,
  mimeType: 'application/pdf',
  body: pdf(title, lines),
})

const sheet = (name: string, header: string[], rows: (string | number)[][]): Doc => ({
  name,
  mimeType: 'text/csv',
  body: csv(header, rows),
})

const TREE: Node = {
  name: ROOM,
  files: [
    {
      name: 'Index.txt',
      mimeType: 'text/plain',
      body: text([
        'Project Atlas - due diligence index',
        '',
        '01 Corporate     incorporation, articles, cap table',
        '02 Financials    audited accounts and the current quarter',
        '03 Legal         customer agreements and litigation',
        '04 Commercial    revenue by cohort, roadmap',
        '',
        'Questions to the deal team, not to the folder owners.',
      ]),
    },
  ],
  folders: [
    {
      name: '01 Corporate',
      files: [
        document('Certificate of incorporation.pdf', 'Certificate of incorporation', [
          'Atlas Technologies Limited',
          'Company number 09482113',
          'Incorporated 4 March 2019 in England and Wales',
          '',
          'This certificate is a sample document generated for the demo data room.',
        ]),
        document('Articles of association.pdf', 'Articles of association', [
          'Adopted by special resolution on 12 June 2023.',
          '',
          '1. Share capital is divided into ordinary and preferred shares.',
          '2. The board consists of no fewer than three directors.',
          '3. Transfers of shares require board approval.',
          '',
          'Sample document generated for the demo data room.',
        ]),
        sheet(
          'Cap table.csv',
          ['holder', 'class', 'shares', 'percent'],
          [
            ['Founders', 'Ordinary', 4200000, '42.0'],
            ['Seed investors', 'Preferred A', 2100000, '21.0'],
            ['Series A', 'Preferred B', 2700000, '27.0'],
            ['Option pool', 'Ordinary', 1000000, '10.0'],
          ],
        ),
      ],
    },
    {
      name: '02 Financials',
      files: [
        document('FY2024 audited accounts.pdf', 'FY2024 audited accounts', [
          'Revenue                          12,480,000',
          'Cost of sales                    -4,120,000',
          'Gross profit                      8,360,000',
          'Operating expenses               -6,940,000',
          'Operating profit                  1,420,000',
          '',
          'Audited by Hollis and Fenn LLP, 28 February 2025.',
        ]),
      ],
      folders: [
        {
          name: 'Q4 2025',
          files: [
            sheet(
              'Balance sheet.csv',
              ['line', 'q4_2025', 'q3_2025'],
              [
                ['Cash', 4820000, 4110000],
                ['Receivables', 1940000, 2210000],
                ['Total assets', 9760000, 9330000],
                ['Payables', 1120000, 1290000],
                ['Total equity', 7290000, 6740000],
              ],
            ),
            sheet(
              'Profit and loss.csv',
              ['line', 'q4_2025'],
              [
                ['Revenue', 3610000],
                ['Cost of sales', -1180000],
                ['Gross profit', 2430000],
                ['Operating expenses', -1870000],
                ['Operating profit', 560000],
              ],
            ),
            document('Management accounts.pdf', 'Management accounts, Q4 2025', [
              'Revenue grew 9 percent on the quarter, driven by the enterprise tier.',
              'Gross margin held at 67 percent.',
              'Headcount ended the quarter at 84, against a plan of 88.',
              '',
              'Sample document generated for the demo data room.',
            ]),
          ],
        },
      ],
    },
    {
      name: '03 Legal',
      files: [
        document('Litigation summary.pdf', 'Litigation summary', [
          'One open matter as at 31 December 2025.',
          '',
          'Redmond Systems v. Atlas Technologies, contract dispute.',
          'Claim value 240,000. Counsel considers the claim unlikely to succeed.',
          '',
          'Sample document generated for the demo data room.',
        ]),
      ],
      folders: [
        {
          name: 'Customer agreements',
          files: [
            document('MSA - Northwind.pdf', 'Master services agreement', [
              'Between Atlas Technologies Limited and Northwind Trading Company.',
              'Effective 1 April 2024, initial term 36 months.',
              'Annual value 480,000, payable quarterly in advance.',
              '',
              'Sample document generated for the demo data room.',
            ]),
            document('MSA - Contoso.pdf', 'Master services agreement', [
              'Between Atlas Technologies Limited and Contoso Group plc.',
              'Effective 15 September 2023, initial term 24 months.',
              'Annual value 310,000, payable monthly.',
              '',
              'Sample document generated for the demo data room.',
            ]),
          ],
        },
      ],
    },
    {
      name: '04 Commercial',
      files: [
        sheet(
          'Revenue by cohort.csv',
          ['cohort', 'accounts', 'year_1', 'year_2', 'year_3'],
          [
            ['2022', 41, 1240000, 1490000, 1610000],
            ['2023', 58, 1880000, 2240000, ''],
            ['2024', 73, 2610000, '', ''],
            ['2025', 66, 2480000, '', ''],
          ],
        ),
        document('Product roadmap.pdf', 'Product roadmap 2026', [
          'H1  Single sign-on, audit export, regional data residency',
          'H2  Workflow automation, partner API, mobile review',
          '',
          'Dates are indicative and not contractual.',
          '',
          'Sample document generated for the demo data room.',
        ]),
      ],
    },
  ],
}

async function account(email: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing.id

  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })

  // The account may already exist in Supabase from an earlier run even though
  // our own row was removed with the room.
  const id =
    created.data.user?.id ??
    (await admin.auth.admin.listUsers()).data.users.find((user) => user.email === email)?.id
  if (!id) throw created.error ?? new Error(`Could not create ${email}`)

  await prisma.user.upsert({
    where: { id },
    create: { id, email },
    update: { email },
  })
  return id
}

interface Placed {
  id: string
  path: string
  depth: number
}

/**
 * Writes one folder, its files, and everything under it. Folders are recorded by
 * name in `placed` so the shares below can point at two of them without walking
 * the tree again.
 */
async function plant(
  node: Node,
  roomId: string,
  parent: Placed | null,
  placed: Map<string, Placed>,
): Promise<Placed> {
  const id = newId()
  const here: Placed = {
    id,
    path: parent ? childPath(parent.path, id) : rootPath(id),
    depth: parent ? parent.depth + 1 : 0,
  }

  await prisma.folder.create({
    data: {
      id,
      dataRoomId: roomId,
      parentId: parent?.id ?? null,
      name: node.name,
      path: here.path,
      depth: here.depth,
    },
  })
  placed.set(node.name, here)

  for (const file of node.files ?? []) {
    const fileId = newId()
    const key = objectKey(roomId, fileId)
    await putObject(key, file.body, file.mimeType)
    await prisma.file.create({
      data: {
        id: fileId,
        dataRoomId: roomId,
        folderId: id,
        name: file.name,
        storageKey: key,
        sizeBytes: BigInt(file.body.byteLength),
        mimeType: file.mimeType,
      },
    })
  }

  for (const child of node.folders ?? []) {
    await plant(child, roomId, here, placed)
  }

  return here
}

async function main() {
  const ownerId = await account(OWNER)
  const readerId = await account(READER)

  const stale = await prisma.dataRoom.findFirst({ where: { ownerId, name: ROOM } })
  if (stale) {
    const keys = await listRoomObjects(stale.id)
    await prisma.dataRoom.delete({ where: { id: stale.id } })
    await removeObjects(keys)
    console.log('replaced the previous demo room')
  }

  const roomId = newId()
  await prisma.dataRoom.create({ data: { id: roomId, ownerId, name: ROOM } })

  const placed = new Map<string, Placed>()
  await plant(TREE, roomId, null, placed)

  const legal = placed.get('03 Legal')
  const q4 = placed.get('Q4 2025')
  if (!legal || !q4) throw new Error('the demo tree changed shape')

  await prisma.share.createMany({
    data: [
      {
        id: newId(),
        dataRoomId: roomId,
        resourceType: 'folder',
        resourceId: legal.id,
        resourcePath: legal.path,
        mode: 'user',
        granteeUserId: readerId,
        granteeEmail: READER,
        createdById: ownerId,
      },
      {
        id: newId(),
        dataRoomId: roomId,
        resourceType: 'folder',
        resourceId: q4.id,
        resourcePath: q4.path,
        mode: 'public_link',
        // Fixed rather than random so the README can print the link.
        token: 'atlas-q4-2025-review',
        createdById: ownerId,
      },
    ],
  })

  const files = await prisma.file.aggregate({
    where: { dataRoomId: roomId },
    _count: { _all: true },
    _sum: { sizeBytes: true },
  })

  console.log(`\n${ROOM} is ready`)
  console.log(`  owner   ${OWNER} / ${PASSWORD}`)
  console.log(`  reader  ${READER} / ${PASSWORD}, invited to 03 Legal`)
  console.log(`  link    /l/atlas-q4-2025-review`)
  console.log(`  ${files._count._all} files, ${files._sum.sizeBytes} bytes`)
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
