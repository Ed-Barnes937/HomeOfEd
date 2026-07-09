import { describe, expect, it } from 'vitest'
import { isNew } from './isNew.ts'

const now = new Date('2026-07-09T12:00:00Z')
const daysAgo = (n: number): string => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

describe('isNew', () => {
  it('is false when there is no deploy date', () => {
    expect(isNew(undefined, now)).toBe(false)
  })

  it('is true within the two-week window', () => {
    expect(isNew(daysAgo(0), now)).toBe(true)
    expect(isNew(daysAgo(5), now)).toBe(true)
    expect(isNew(daysAgo(13), now)).toBe(true)
  })

  it('is false once two weeks have elapsed (boundary is exclusive)', () => {
    expect(isNew(daysAgo(14), now)).toBe(false)
    expect(isNew(daysAgo(20), now)).toBe(false)
  })

  it('is false for a future deploy date (not live yet)', () => {
    expect(isNew(daysAgo(-3), now)).toBe(false)
  })

  it('is false for an unparseable date', () => {
    expect(isNew('not-a-date', now)).toBe(false)
  })
})
