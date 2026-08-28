/** How many page numbers stand in the pager at once. */
export const WINDOW = 3

export interface PageWindow {
  /** Always three, whatever the folder holds. Some of them may not exist yet. */
  numbers: number[]
  start: number
  canGoBack: boolean
  canGoForward: boolean
}

/**
 * The numbers a pager shows, and whether each arrow has anywhere to go.
 *
 * Always three numbers, in one folder or in a hundred; what changes is how many
 * of them are alive. The arrows scroll the window rather than turning the page,
 * so they stay dead until there is a fourth page to scroll to, and the right one
 * dies again once the window reaches the end.
 */
export function pageWindow(pages: number, start: number): PageWindow {
  const furthest = Math.max(1, pages - WINDOW + 1)
  const from = Math.min(Math.max(1, start), furthest)

  const numbers: number[] = []
  for (let n = from; n <= from + WINDOW - 1; n++) numbers.push(n)

  return {
    numbers,
    start: from,
    canGoBack: from > 1,
    canGoForward: from + WINDOW - 1 < pages,
  }
}

/** A number the pager draws but the folder does not have. Shown, not clickable. */
export const isLive = (number: number, pages: number): boolean => number <= pages

/**
 * Where the window sits when a listing opens on a page somebody linked to, so
 * the page they asked for is one of the numbers they can see.
 */
export function windowFor(page: number, pages: number): number {
  return Math.min(Math.max(1, page - 1), Math.max(1, pages - WINDOW + 1))
}
