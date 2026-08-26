import { describe, expect, it } from 'vitest'
import { ancestorPaths, childPath, depthOf, parentPathOf, rootPath, subtreePattern } from './path.js'

const A = '018f1c00-0000-7000-8000-000000000001'
const B = '018f1c00-0000-7000-8000-000000000002'
const C = '018f1c00-0000-7000-8000-000000000003'

describe('rootPath', () => {
  it('wraps a single id in separators', () => {
    expect(rootPath(A)).toBe(`/${A}/`)
  })
})

describe('childPath', () => {
  it('appends to the parent', () => {
    expect(childPath(rootPath(A), B)).toBe(`/${A}/${B}/`)
  })
})

describe('depthOf', () => {
  it('counts ancestors, a root being zero', () => {
    expect(depthOf(rootPath(A))).toBe(0)
    expect(depthOf(childPath(rootPath(A), B))).toBe(1)
  })
})

describe('parentPathOf', () => {
  it('drops the last segment', () => {
    expect(parentPathOf(`/${A}/${B}/`)).toBe(`/${A}/`)
  })

  it('returns null at the root', () => {
    expect(parentPathOf(`/${A}/`)).toBeNull()
  })
})

describe('ancestorPaths', () => {
  it('lists every prefix including the node itself', () => {
    expect(ancestorPaths(`/${A}/${B}/${C}/`)).toEqual([`/${A}/`, `/${A}/${B}/`, `/${A}/${B}/${C}/`])
  })

  it('handles a root', () => {
    expect(ancestorPaths(`/${A}/`)).toEqual([`/${A}/`])
  })
})

describe('subtreePattern', () => {
  it('is the path followed by a wildcard', () => {
    expect(subtreePattern(`/${A}/${B}/`)).toBe(`/${A}/${B}/%`)
  })
})

// Everything above leans on paths ending in a separator: it is what stops the
// pattern "/aa/%" from dragging a sibling "/aab/" into the subtree.
describe('trailing separator', () => {
  it('is produced by every path builder', () => {
    const deep = childPath(childPath(rootPath(A), B), C)
    expect(rootPath(A).endsWith('/')).toBe(true)
    expect(deep.endsWith('/')).toBe(true)
    expect(parentPathOf(deep)!.endsWith('/')).toBe(true)
    for (const path of ancestorPaths(deep)) {
      expect(path.endsWith('/')).toBe(true)
    }
  })
})
