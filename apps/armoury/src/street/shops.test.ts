import { describe, expect, it } from 'vitest'

import { openingLeft, outlinePoints, SHOPS, STREET_PAINTING, type StreetShop } from './shops.ts'

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

describe('openingLeft', () => {
  const shop = (id: string) => SHOPS.find((s) => s.id === id) as StreetShop
  const span = (id: string): [number, number] => {
    const xs = outlinePoints(shop(id).outline).map(([x]) => x)
    return [Math.min(...xs), Math.max(...xs)]
  }
  const view = STREET_PAINTING.width / 4

  it('lines the wand shop up with the left of the view, at its end of the street', () => {
    expect(openingLeft(shop('wands'), view)).toBe(span('wands')[0])
  })

  it('lines the smithy up with the right of the view, at its end of the street', () => {
    expect(openingLeft(shop('smithy'), view)).toBe(span('smithy')[1] - view)
  })

  it('never looks past either end of the painting', () => {
    for (const s of SHOPS) {
      const left = openingLeft(s, view)
      expect(left).toBeGreaterThanOrEqual(0)
      expect(left + view).toBeLessThanOrEqual(STREET_PAINTING.width)
    }
  })
})
