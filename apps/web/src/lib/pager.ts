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
 * The pager is always three numbers and two arrows, in one folder or in a
 * hundred: a control that appears only once a folder outgrows a page is a
 * control nobody knows is there. What changes is how much of it is alive. One
 * page lights one number, two pages light two, and the arrows wake up at four,
 * where there is finally a fourth number to scroll to.
 *
 * The arrows scroll the window rather than turning the page, so the right one
 * dies again the moment the window reaches the end.
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
