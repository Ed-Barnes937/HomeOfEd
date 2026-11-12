import { describe, expect, it } from 'vitest'

import { shopNumber } from './shopNumber.ts'

describe('shopNumber', () => {
  it('is four digits, and the same whatever order the params come in', () => {
    expect(shopNumber({ family: 'dagger', length: 0.5 })).toMatch(/^\d{4}$/)
    expect(shopNumber({ family: 'dagger', length: 0.5 })).toBe(
      shopNumber({ length: 0.5, family: 'dagger' }),
    )
  })

  it('changes when the item does', () => {
    expect(shopNumber({ family: 'dagger' })).not.toBe(shopNumber({ family: 'longsword' }))
  })

  it('keeps the numbers wands already have', () => {
    expect(shopNumber({})).toBe('2897')
    expect(shopNumber({ wood: 'oak', lengthCm: 33 })).toBe('8154')
  })
})
