import { describe, expect, it } from 'vitest'
import { orderAfterDrop } from './columns'

const ORDER = ['access', 'size', 'modified'] as const

describe('orderAfterDrop', () => {
  it('swaps the first column with the second, which is the one that used to do nothing', () => {
    expect(orderAfterDrop([...ORDER], 'access', 'size')).toEqual(['size', 'access', 'modified'])
  })

  it('swaps the second back with the first', () => {
    expect(orderAfterDrop([...ORDER], 'size', 'access')).toEqual(['size', 'access', 'modified'])
  })

  it('carries the first column all the way to the end', () => {
    expect(orderAfterDrop([...ORDER], 'access', 'modified')).toEqual(['size', 'modified', 'access'])
  })

  it('carries the last one all the way to the front', () => {
    expect(orderAfterDrop([...ORDER], 'modified', 'access')).toEqual(['modified', 'access', 'size'])
  })

  it('leaves a column dropped on itself alone', () => {
    expect(orderAfterDrop([...ORDER], 'size', 'size')).toEqual([...ORDER])
  })
})
