import { describe, expect, test } from 'vitest'

import { arrowPoints, outcomePoint, RING, spokeLine, spokePoint } from './ringGeometry.ts'

/** Distance from the ring's centre, in the 0-100 box. */
function radiusOf(point: { x: number; y: number }): number {
  return Math.hypot(point.x - RING.centre, point.y - RING.centre)
}

describe('spoke placement', () => {
  test("the first spoke is always at twelve o'clock, whatever the count", () => {
    for (const count of [1, 2, 5, 16]) {
      const first = spokePoint(0, count)
      expect(first.x).toBeCloseTo(RING.centre, 6)
      expect(first.y).toBeCloseTo(RING.centre - RING.radius, 6)
    }
  })

  test('they are evenly spaced clockwise, all on the ring', () => {
    const points = [0, 1, 2, 3].map((index) => spokePoint(index, 4))
    for (const point of points) expect(radiusOf(point)).toBeCloseTo(RING.radius, 6)

    // Quarter turns: right, bottom, left.
    expect(points[1]!.x).toBeCloseTo(RING.centre + RING.radius, 6)
    expect(points[2]!.y).toBeCloseTo(RING.centre + RING.radius, 6)
    expect(points[3]!.x).toBeCloseTo(RING.centre - RING.radius, 6)
  })
})

describe('the line and the words on it', () => {
  test('a spoke starts clear of the centre tile and stops clear of the ring tile', () => {
    const point = spokePoint(1, 3)
    const { from, to } = spokeLine(point)

    expect(radiusOf(from)).toBeCloseTo(RING.centreInset, 6)
    expect(radiusOf(to)).toBeCloseTo(RING.radius - RING.tileInset, 6)
    // Both insets are real: a line that reached either tile would be drawn
    // under it, and the arrowhead with it.
    expect(radiusOf(from)).toBeLessThan(radiusOf(to))
  })

  test('the outcome sits between the two, on the line', () => {
    const point = spokePoint(2, 5)
    const outcome = outcomePoint(point)

    expect(radiusOf(outcome)).toBeCloseTo(RING.radius * RING.outcomeAt, 6)
    expect(outcome.x - RING.centre).toBeCloseTo((point.x - RING.centre) * RING.outcomeAt, 6)
  })
})

describe('arrowheads', () => {
  test('the tip is the point given, and the wings sit behind it', () => {
    const [tip, ...wings] = arrowPoints(50, 20, 0, -1)
      .split(' ')
      .map((pair) => pair.split(',').map(Number) as [number, number])

    expect(tip).toEqual([50, 20])
    // Pointing up, so both wings sit below the tip, one either side of it.
    for (const wing of wings) expect(wing[1]).toBeCloseTo(20 + RING.arrow, 6)
    expect(wings.map((wing) => wing[0]).sort((a, b) => a - b)).toEqual([
      50 - RING.arrow * 0.55,
      50 + RING.arrow * 0.55,
    ])
  })

  test('reversing the direction turns the head around', () => {
    const out = arrowPoints(50, 20, 0, -1)
    const back = arrowPoints(50, 20, 0, 1)

    expect(out).not.toBe(back)
    // Same tip, wings on the other side of it.
    expect(out.split(' ')[0]).toBe(back.split(' ')[0])
    const behind = Number(back.split(' ')[1]!.split(',')[1])
    expect(behind).toBeCloseTo(20 - RING.arrow, 6)
  })
})
