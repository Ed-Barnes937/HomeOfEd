import { describe, expect, it } from 'vitest'

import { appDates, lookupAppDates } from './appDates.ts'

// The mapping is tested against a fixture, not the generated file: CI rewrites
// deployments.json after every deploy, and since ADR 0047 that rewrite goes
// through a PR whose checks run this suite - a pinned live value would turn
// every record PR red.
const record = {
  silt: { firstDeployedAt: '2026-08-07T00:00:00Z', lastDeployedAt: '2026-08-24T00:00:00Z' },
}

describe('lookupAppDates', () => {
  it('maps a recorded app onto the two pill dates', () => {
    expect(lookupAppDates(record, 'silt')).toEqual({
      deployedAt: '2026-08-07T00:00:00Z',
      updatedAt: '2026-08-24T00:00:00Z',
    })
  })

  it('gives an app with no recorded deploy no dates, so it shows no pill', () => {
    expect(lookupAppDates(record, 'heig')).toEqual({})
  })

  it('gives a card with no package name no dates — SOON cards have none', () => {
    expect(lookupAppDates(record, undefined)).toEqual({})
  })
})

describe('appDates (the real record)', () => {
  it('covers every live app on the homepage', () => {
    for (const pkg of ['boids', 'fridge', 'wotd', 'espy', 'karesansui', 'boop', 'silt']) {
      expect(appDates(pkg).deployedAt, pkg).toBeDefined()
    }
  })
})
