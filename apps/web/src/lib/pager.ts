/** How many page numbers stand in the pager at once. */
export const WINDOW = 3

export interface PageWindow {
  numbers: number[]
  start: number
  canGoBack: boolean
  canGoForward: boolean
}

/**
 * The numbers a pager shows, and whether each arrow has anywhere to go.
 *
 * The arrows scroll the window rather than turning the page, which is the whole
 * of the behaviour: with three pages or fewer the window already holds all of
 * them and both arrows are dead, with four the right one comes alive, and it
 * dies again the moment the window reaches the end.
 */
export function pageWindow(pages: number, start: number): PageWindow {
  const furthest = Math.max(1, pages - WINDOW + 1)
  const from = Math.min(Math.max(1, start), furthest)

  const numbers: number[] = []
  for (let n = from; n <= Math.min(pages, from + WINDOW - 1); n++) numbers.push(n)

  return {
    numbers,
    start: from,
    canGoBack: from > 1,
    canGoForward: from + WINDOW - 1 < pages,
  }
}

/**
 * Where the window sits when a listing opens on a page somebody linked to, so
 * the page they asked for is one of the numbers they can see.
 */
export function windowFor(page: number, pages: number): number {
  return Math.min(Math.max(1, page - 1), Math.max(1, pages - WINDOW + 1))
}
