import { describe, expect, it } from 'vitest'

import { openShopsCentreX, outlinePoints, SHOPS, STREET_PAINTING } from './shops.ts'

describe('the shops on the street', () => {
  it('are eight, each with its own id', () => {
    expect(SHOPS).toHaveLength(8)
    expect(new Set(SHOPS.map((shop) => shop.id)).size).toBe(8)
  })

  it('open only the wand shop and the smithy', () => {
    const open = SHOPS.filter((shop) => shop.to).map((shop) => [shop.id, shop.to])
    expect(open).toEqual([
      ['wands', '/wands'],
      ['smithy', '/swords'],
    ])
  })

  it.each(SHOPS.map((shop) => [shop.id, shop.outline]))(
    "trace %s's front as one closed shape in absolute coordinates",
    (_, outline) => {
      expect(outline.trim()).toMatch(/^M[\d\s,.\-LCQ]*Z$/)
    },
  )

  it.each(SHOPS.map((shop) => [shop.id, shop.outline]))(
    "keep %s's outline inside the painting",
    (_, outline) => {
      const points = outlinePoints(outline)
      expect(points.length).toBeGreaterThanOrEqual(3)
      for (const [x, y] of points) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(STREET_PAINTING.width)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(STREET_PAINTING.height)
      }
    },
  )
})

describe('outlinePoints', () => {
  it('reads every point of lines and curves', () => {
    expect(outlinePoints('M 0,10 L 5 0 Q 8,1 10,10 C 9 12, 1 12, 0 10 Z')).toEqual([
      [0, 10],
      [5, 0],
      [8, 1],
      [10, 10],
      [9, 12],
      [1, 12],
      [0, 10],
    ])
  })
})

describe('openShopsCentreX', () => {
  it('is midway between the outer sides of the open shops', () => {
    const xs = SHOPS.filter((shop) => shop.to).flatMap((shop) =>
      outlinePoints(shop.outline).map(([x]) => x),
    )
    const centre = openShopsCentreX()
    expect(centre - Math.min(...xs)).toBeCloseTo(Math.max(...xs) - centre)
  })
})
