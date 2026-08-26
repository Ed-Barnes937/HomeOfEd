import { describe, expect, it } from 'vitest'

import { appDates } from './appDates.ts'

describe('appDates', () => {
  it('maps a recorded app onto the two pill dates', () => {
    const silt = appDates('silt')
    expect(silt.deployedAt).toBe('2026-08-07T00:00:00Z')
    expect(silt.updatedAt).toBe('2026-08-24T00:00:00Z')
  })

  it('gives an app with no recorded deploy no dates, so it shows no pill', () => {
    expect(appDates('heig')).toEqual({})
  })

  it('gives a card with no package name no dates — SOON cards have none', () => {
    expect(appDates(undefined)).toEqual({})
  })

  it('covers every live app on the homepage', () => {
    for (const pkg of ['boids', 'fridge', 'wotd', 'espy', 'karesansui', 'boop', 'silt']) {
      expect(appDates(pkg).deployedAt, pkg).toBeDefined()
    }
  })
})
