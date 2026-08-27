import { describe, expect, it } from 'vitest'
import { isInherited, lookupKeys, pickGrantingShare, shareCovers, type LiveShare, type Target } from './access.js'

const ROOM = 'r0000000-0000-7000-8000-000000000001'
const FINANCIALS = 'f0000000-0000-7000-8000-000000000002'
const Q4 = 'f0000000-0000-7000-8000-000000000003'
const LEGAL = 'f0000000-0000-7000-8000-000000000004'
const CAP_TABLE = 'd0000000-0000-7000-8000-000000000005'

const rootPath = `/${ROOM}/`
const financialsPath = `/${ROOM}/${FINANCIALS}/`
const q4Path = `/${ROOM}/${FINANCIALS}/${Q4}/`
const legalPath = `/${ROOM}/${LEGAL}/`

const q4: Target = { kind: 'folder', id: Q4, path: q4Path }
const capTable: Target = { kind: 'file', id: CAP_TABLE, folderPath: q4Path }

function folderShare(path: string, over: 'data_room' | 'folder' = 'folder'): LiveShare {
  return {
    id: `share-${path}`,
    resourceType: over,
    resourceId: path.split('/').filter(Boolean).at(-1)!,
    resourcePath: path,
    mode: 'public_link',
    granteeUserId: null,
  }
}

function fileShare(fileId: string): LiveShare {
  return {
    id: `share-file-${fileId}`,
    resourceType: 'file',
    resourceId: fileId,
    resourcePath: null,
    mode: 'user',
    granteeUserId: 'someone',
  }
}

describe('lookupKeys', () => {
  it('asks about every folder above a folder, and the folder itself', () => {
    expect(lookupKeys(q4)).toEqual({ paths: [rootPath, financialsPath, q4Path], fileId: null })
  })

  it('asks about the file itself as well as the folders above it', () => {
    expect(lookupKeys(capTable)).toEqual({
      paths: [rootPath, financialsPath, q4Path],
      fileId: CAP_TABLE,
    })
  })
})

describe('shareCovers', () => {
  it('lets a share of the whole room reach a folder deep inside it', () => {
    expect(shareCovers(folderShare(rootPath, 'data_room'), q4)).toBe(true)
  })

  it('lets a share of the whole room reach a file deep inside it', () => {
    expect(shareCovers(folderShare(rootPath, 'data_room'), capTable)).toBe(true)
  })

  it('covers the folder it was granted on', () => {
    expect(shareCovers(folderShare(q4Path), q4)).toBe(true)
  })

  it('covers a descendant', () => {
    expect(shareCovers(folderShare(financialsPath), q4)).toBe(true)
  })

  // This is the leak the whole model exists to prevent: sharing one branch must
  // not hand over a neighbouring one.
  it('does not reach a sibling branch', () => {
    expect(shareCovers(folderShare(legalPath), q4)).toBe(false)
    expect(shareCovers(folderShare(legalPath), capTable)).toBe(false)
  })

  it('does not reach upwards from the folder it was granted on', () => {
    const financials: Target = { kind: 'folder', id: FINANCIALS, path: financialsPath }
    expect(shareCovers(folderShare(q4Path), financials)).toBe(false)
  })

  it('a share of one file covers that file and nothing else', () => {
    expect(shareCovers(fileShare(CAP_TABLE), capTable)).toBe(true)
    expect(shareCovers(fileShare('another-file'), capTable)).toBe(false)
    expect(shareCovers(fileShare(CAP_TABLE), q4)).toBe(false)
  })
})

describe('pickGrantingShare', () => {
  it('names the closest folder, not the outermost one', () => {
    const granting = pickGrantingShare(q4, [
      folderShare(rootPath, 'data_room'),
      folderShare(financialsPath),
    ])
    expect(granting?.resourcePath).toBe(financialsPath)
  })

  it('prefers a share of the file itself over anything above it', () => {
    const granting = pickGrantingShare(capTable, [
      folderShare(financialsPath),
      fileShare(CAP_TABLE),
    ])
    expect(granting?.resourceType).toBe('file')
  })

  it('ignores shares that do not cover the target', () => {
    expect(pickGrantingShare(q4, [folderShare(legalPath)])).toBeNull()
  })

  it('returns null when there are no shares at all', () => {
    expect(pickGrantingShare(q4, [])).toBeNull()
  })
})

describe('isInherited', () => {
  it('is false for the folder the share was granted on', () => {
    expect(isInherited(q4, folderShare(q4Path))).toBe(false)
  })

  it('is true for a folder below the one that was shared', () => {
    expect(isInherited(q4, folderShare(financialsPath))).toBe(true)
  })

  // A file always sits below the folder that was shared, even when that folder is
  // its own parent, so it is always inherited unless the file itself was shared.
  it('is true for a file inside a shared folder', () => {
    expect(isInherited(capTable, folderShare(q4Path))).toBe(true)
  })

  it('is false for a file shared on its own', () => {
    expect(isInherited(capTable, fileShare(CAP_TABLE))).toBe(false)
  })
})
