import { describe, expect, it } from 'vitest'

import { randomShareId } from './idGen.ts'

describe('randomShareId', () => {
  it('returns a 10-char base62 string by default', () => {
    const id = randomShareId()
    expect(id).toHaveLength(10)
    expect(id).toMatch(/^[A-Za-z0-9]{10}$/)
  })

  it('respects a custom length', () => {
    expect(randomShareId(4)).toHaveLength(4)
  })

  it('is not deterministic across calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => randomShareId()))
    expect(ids.size).toBe(20)
  })
})
