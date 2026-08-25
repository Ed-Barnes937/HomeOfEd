import { describe, expect, it } from 'vitest'
import { isUpdated } from './isUpdated.ts'

const now = new Date('2026-08-24T12:00:00Z')
const daysAgo = (n: number): string =>
  new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

describe('isUpdated', () => {
  it('is false when there is no update date', () => {
    expect(isUpdated(undefined, now)).toBe(false)
  })

  it('is true within the two-week window', () => {
    expect(isUpdated(daysAgo(0), now)).toBe(true)
    expect(isUpdated(daysAgo(5), now)).toBe(true)
    expect(isUpdated(daysAgo(13), now)).toBe(true)
  })

  it('is false once two weeks have elapsed (boundary is exclusive)', () => {
    expect(isUpdated(daysAgo(14), now)).toBe(false)
    expect(isUpdated(daysAgo(20), now)).toBe(false)
  })

  it('is false for a future update date (not shipped yet)', () => {
    expect(isUpdated(daysAgo(-3), now)).toBe(false)
  })

  it('is false for an unparseable date', () => {
    expect(isUpdated('not-a-date', now)).toBe(false)
  })
})
