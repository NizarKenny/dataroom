export type SortBy = 'name' | 'size' | 'modified'
export type SortDir = 'asc' | 'desc'

export interface Sort {
  by: SortBy
  dir: SortDir
}

/** Where the list stands when nobody has asked for anything. */
export const DEFAULT_SORT: Sort = { by: 'name', dir: 'asc' }

/**
 * The first click on a column asks the question that column is usually asked:
 * the biggest files, the newest changes, names from the top. The second click
 * turns it round, and the third puts the list back the way it was found.
 */
const FIRST: Record<SortBy, SortDir> = { name: 'asc', size: 'desc', modified: 'desc' }

export function nextSort(current: Sort, column: SortBy): Sort {
  if (current.by !== column) return { by: column, dir: FIRST[column] }
  if (current.dir === FIRST[column])
    return { by: column, dir: FIRST[column] === 'asc' ? 'desc' : 'asc' }
  return DEFAULT_SORT
}

export const isDefaultSort = (sort: Sort) =>
  sort.by === DEFAULT_SORT.by && sort.dir === DEFAULT_SORT.dir
