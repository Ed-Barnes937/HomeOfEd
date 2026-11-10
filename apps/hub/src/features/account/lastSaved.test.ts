import { describe, expect, it } from 'vitest'

import { lastSavedLines, savedAgo } from './lastSaved.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const now = Date.parse('2026-11-10T12:00:00Z')

describe('savedAgo', () => {
  it('says just now inside the first minute, and for a save the device clock puts ahead', () => {
    expect(savedAgo(now, now)).toBe('saved just now')
    expect(savedAgo(now - 59_000, now)).toBe('saved just now')
    expect(savedAgo(now + 5 * MINUTE, now)).toBe('saved just now')
  })

  it('counts whole minutes, then hours, then days', () => {
    expect(savedAgo(now - MINUTE, now)).toBe('saved 1 minute ago')
    expect(savedAgo(now - 59 * MINUTE, now)).toBe('saved 59 minutes ago')
    expect(savedAgo(now - HOUR, now)).toBe('saved 1 hour ago')
    expect(savedAgo(now - 23 * HOUR - 59 * MINUTE, now)).toBe('saved 23 hours ago')
    expect(savedAgo(now - DAY, now)).toBe('saved 1 day ago')
    expect(savedAgo(now - 2 * DAY - 5 * HOUR, now)).toBe('saved 2 days ago')
    expect(savedAgo(now - 59 * DAY, now)).toBe('saved 59 days ago')
  })

  it('counts months past two months, and years past a year', () => {
    expect(savedAgo(now - 60 * DAY, now)).toBe('saved 2 months ago')
    expect(savedAgo(now - 364 * DAY, now)).toBe('saved 12 months ago')
    expect(savedAgo(now - 365 * DAY, now)).toBe('saved 1 year ago')
    expect(savedAgo(now - 3 * 365 * DAY, now)).toBe('saved 3 years ago')
  })
})

describe('lastSavedLines', () => {
  const summary = [
    { accountId: 'child-robin', appId: 'boop', updatedAt: now - 2 * DAY },
    { accountId: 'child-robin', appId: 'silt', updatedAt: now - 3 * HOUR },
    { accountId: 'parent-ada', appId: 'boop', updatedAt: now - 10 * MINUTE },
  ]

  it("gives one line per app with a save, for that account only, in the summary's order", () => {
    expect(lastSavedLines(summary, 'child-robin', now)).toEqual([
      'boop: saved 2 days ago',
      'silt: saved 3 hours ago',
    ])
    expect(lastSavedLines(summary, 'parent-ada', now)).toEqual(['boop: saved 10 minutes ago'])
  })

  it('gives nothing for an account with no saves', () => {
    expect(lastSavedLines(summary, 'child-wren', now)).toEqual([])
    expect(lastSavedLines([], 'child-robin', now)).toEqual([])
  })
})
