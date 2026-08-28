import { describe, expect, it } from 'vitest'
import { DEFAULT_SORT, nextSort } from './sort'

describe('nextSort', () => {
  it('asks a size column for the big ones first', () => {
    expect(nextSort(DEFAULT_SORT, 'size')).toEqual({ by: 'size', dir: 'desc' })
  })

  it('turns it round on the second click', () => {
    expect(nextSort({ by: 'size', dir: 'desc' }, 'size')).toEqual({ by: 'size', dir: 'asc' })
  })

  it('and puts the list back on the third', () => {
    expect(nextSort({ by: 'size', dir: 'asc' }, 'size')).toEqual(DEFAULT_SORT)
  })

  it('asks a date column for the newest first', () => {
    expect(nextSort(DEFAULT_SORT, 'modified')).toEqual({ by: 'modified', dir: 'desc' })
  })

  it('but a name column from the top, since that is what a name is for', () => {
    expect(nextSort({ by: 'size', dir: 'asc' }, 'name')).toEqual({ by: 'name', dir: 'asc' })
  })

  it('starts the cycle over when the click lands on a different column', () => {
    expect(nextSort({ by: 'size', dir: 'asc' }, 'modified')).toEqual({
      by: 'modified',
      dir: 'desc',
    })
  })
})
