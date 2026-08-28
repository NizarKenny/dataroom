import { describe, expect, it } from 'vitest'
import { isLive, pageWindow, windowFor } from './pager'

describe('pageWindow', () => {
  it('draws three numbers for a folder that fits on one page', () => {
    expect(pageWindow(1, 1)).toMatchObject({
      numbers: [1, 2, 3],
      canGoBack: false,
      canGoForward: false,
    })
  })

  it('draws the same three for two pages', () => {
    expect(pageWindow(2, 1)).toMatchObject({
      numbers: [1, 2, 3],
      canGoBack: false,
      canGoForward: false,
    })
  })

  it('shows three, which is the whole window, so both arrows are dead', () => {
    expect(pageWindow(3, 1)).toMatchObject({
      numbers: [1, 2, 3],
      canGoBack: false,
      canGoForward: false,
    })
  })

  it('wakes the right arrow at four pages', () => {
    expect(pageWindow(4, 1)).toMatchObject({
      numbers: [1, 2, 3],
      canGoBack: false,
      canGoForward: true,
    })
  })

  it('and swaps which arrow is live once the window has moved', () => {
    expect(pageWindow(4, 2)).toMatchObject({
      numbers: [2, 3, 4],
      canGoBack: true,
      canGoForward: false,
    })
  })

  it('leaves both live in the middle of a long list', () => {
    expect(pageWindow(9, 4)).toMatchObject({
      numbers: [4, 5, 6],
      canGoBack: true,
      canGoForward: true,
    })
  })

  it('will not scroll past the end, however hard it is pushed', () => {
    expect(pageWindow(5, 99)).toMatchObject({ numbers: [3, 4, 5], canGoForward: false })
    expect(pageWindow(5, -3)).toMatchObject({ numbers: [1, 2, 3], canGoBack: false })
  })
})

describe('isLive', () => {
  it('lights only the pages the folder actually has', () => {
    expect([1, 2, 3].map((n) => isLive(n, 1))).toEqual([true, false, false])
    expect([1, 2, 3].map((n) => isLive(n, 2))).toEqual([true, true, false])
    expect([1, 2, 3].map((n) => isLive(n, 9))).toEqual([true, true, true])
  })
})

describe('windowFor', () => {
  it('keeps a linked page in view', () => {
    expect(windowFor(7, 12)).toBe(6)
    expect(pageWindow(12, windowFor(7, 12)).numbers).toContain(7)
  })

  it('does not run off either end', () => {
    expect(windowFor(1, 12)).toBe(1)
    expect(windowFor(12, 12)).toBe(10)
  })
})
