import { describe, expect, it } from 'vitest'

import { pillFor } from './pillFor.ts'

const now = new Date('2026-08-24T12:00:00Z')
const daysAgo = (n: number): string =>
  new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

describe('pillFor', () => {
  it('shows New for an app that went live inside the window', () => {
    expect(pillFor({ deployedAt: daysAgo(3), updatedAt: daysAgo(3) }, now)).toBe('new')
  })

  it('shows New rather than Updated while both windows are open', () => {
    expect(pillFor({ deployedAt: daysAgo(10), updatedAt: daysAgo(1) }, now)).toBe('new')
  })

  it('shows Updated once the launch has aged out but the change has not', () => {
    expect(pillFor({ deployedAt: daysAgo(60), updatedAt: daysAgo(1) }, now)).toBe('updated')
  })

  it('shows nothing once both windows have closed', () => {
    expect(pillFor({ deployedAt: daysAgo(60), updatedAt: daysAgo(30) }, now)).toBe(null)
  })

  it('shows nothing for a card with no recorded deploy', () => {
    expect(pillFor({}, now)).toBe(null)
  })
})
