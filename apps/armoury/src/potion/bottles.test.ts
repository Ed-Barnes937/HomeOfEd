import { describe, expect, it } from 'vitest'

import {
  BOTTLES,
  drawnHeightMm,
  neckLengthMm,
  type ShapeId,
  STOPPER_ALLOWANCE_MM,
} from './bottles.ts'

const SHAPES = Object.keys(BOTTLES) as ShapeId[]

describe('BOTTLES', () => {
  it('has a row for each of the five shapes', () => {
    expect([...SHAPES].sort()).toEqual(['gourd', 'round', 'shoulder', 'tall', 'teardrop'])
  })

  it('names each shape and its noun', () => {
    expect(BOTTLES.round).toMatchObject({ label: 'Round flask', noun: 'round flask' })
    expect(BOTTLES.teardrop).toMatchObject({ label: 'Teardrop flask', noun: 'teardrop flask' })
  })

  it('has body points rising from the foot, with a neck range inside 10-45 mm', () => {
    for (const s of SHAPES) {
      const row = BOTTLES[s]
      expect(row.neckMm[0]).toBeGreaterThanOrEqual(10)
      expect(row.neckMm[0]).toBeLessThan(row.neckMm[1])
      expect(row.neckMm[1]).toBeLessThanOrEqual(45)
      expect(row.body[0]![0]).toBe(0)
      expect(row.body.at(-1)![0]).toBe(1)
      const heights = row.body.map(([h]) => h)
      expect(heights).toEqual([...heights].sort((a, b) => a - b))
      for (const [, r] of row.body) expect(r).toBeGreaterThan(0)
    }
  })

  it('gives the gourd a waist between two bulbs', () => {
    const radius = (h: number) => BOTTLES.gourd.body.find(([f]) => f === h)![1]
    expect(radius(0.5)).toBeLessThan(radius(0.25))
    expect(radius(0.5)).toBeLessThan(radius(0.72))
  })
})

describe('neckLengthMm and drawnHeightMm', () => {
  it('maps the neck slider into the shape range', () => {
    const [min, max] = BOTTLES.round.neckMm
    expect(neckLengthMm({ shape: 'round', neck: 0 })).toBe(min)
    expect(neckLengthMm({ shape: 'round', neck: 1 })).toBe(max)
  })

  it('grows with neck and adds the stopper allowance', () => {
    for (const shape of SHAPES) {
      expect(drawnHeightMm({ shape, neck: 1 })).toBeGreaterThan(drawnHeightMm({ shape, neck: 0 }))
    }
    const { bodyHeightMm, neckMm } = BOTTLES.tall
    expect(drawnHeightMm({ shape: 'tall', neck: 0 })).toBe(
      bodyHeightMm + neckMm[0] + STOPPER_ALLOWANCE_MM,
    )
  })
})
