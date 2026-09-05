import { describe, expect, test } from 'vitest'

import { entryIndex } from './entries.ts'
import { fieldNotesView } from './fieldNotesView.ts'
import { ringFor } from './panelModel.ts'
import {
  arrowPoints,
  RING,
  RING_CAPACITY,
  spokeLine,
  spokePoint,
  spokeTileBox,
} from './ringGeometry.ts'

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

describe('the line between the tiles', () => {
  test('a spoke starts clear of the centre tile and stops clear of the ring tile', () => {
    const point = spokePoint(1, 3)
    const { from, to } = spokeLine(point)

    expect(radiusOf(from)).toBeCloseTo(RING.centreInset, 6)
    expect(radiusOf(to)).toBeCloseTo(RING.radius - RING.tileInset, 6)
    // Both insets are real: a line that reached either tile would be drawn
    // under it, and the arrowhead with it.
    expect(radiusOf(from)).toBeLessThan(radiusOf(to))
  })

  // The words that used to sit on this line, and the arithmetic that stepped
  // them clear of the arrowheads, are gone with ticket 25: they never fitted the
  // arc they had, so the reading line under the ring says them instead and the
  // line carries nothing but its own head.
})

/**
 * How many spokes the ring can hold before its tiles collide (ticket 09). The
 * capacity is derived from the drawing - the tile size against the smallest
 * ring the panel lays out - so it moves when the design does, and the numbers
 * below are consequences of it rather than a second copy of it.
 */
describe('ring capacity', () => {
  /** Whether two boxes centred on these points overlap at all. */
  function overlap(
    a: { x: number; y: number },
    b: { x: number; y: number },
    box: { halfWidth: number; halfHeight: number },
  ): boolean {
    return Math.abs(a.x - b.x) < box.halfWidth * 2 && Math.abs(a.y - b.y) < box.halfHeight * 2
  }

  /**
   * `count` tiles evenly spaced, the ring turned `turn` degrees. Tiles are
   * squares that do not turn with it, so which rotation a ring happens to be
   * drawn at decides whether a given count collides - and the capacity has to
   * hold for all of them, not just for the twelve o'clock start `spokePoint`
   * uses.
   */
  function ringAt(count: number, turn: number): Array<{ x: number; y: number }> {
    return Array.from({ length: count }, (_, index) => {
      const angle = ((-90 + turn + (index * 360) / count) * Math.PI) / 180
      return {
        x: RING.centre + RING.radius * Math.cos(angle),
        y: RING.centre + RING.radius * Math.sin(angle),
      }
    })
  }

  function collidesAt(count: number, turn: number): boolean {
    const box = spokeTileBox(1)
    const points = ringAt(count, turn)
    return points.some((point, index) =>
      points.slice(index + 1).some((other) => overlap(point, other, box)),
    )
  }

  const turns = Array.from({ length: 91 }, (_, degree) => degree)

  test('it lands where the crowd starts, not on a number someone liked', () => {
    // Not an assertion about the number so much as about the derivation: the
    // screenshot that opened the ticket put the crowd at a dozen-odd spokes,
    // and a capacity outside that band would mean the geometry has moved. What
    // the number *means* is the two cases below.
    expect(RING_CAPACITY).toBeGreaterThanOrEqual(10)
    expect(RING_CAPACITY).toBeLessThanOrEqual(16)
  })

  test('a ring at the capacity draws no two tiles over each other, at any rotation', () => {
    for (const turn of turns) {
      expect({ turn, collides: collidesAt(RING_CAPACITY, turn) }).toEqual({ turn, collides: false })
    }
  })

  test('one spoke over, some rotation of it does - which is what the capacity is for', () => {
    // Not every rotation: at thirteen the twelve o'clock ring happens to miss
    // itself, and a capacity that trusted that would collide the day a spoke
    // count moved the angles by a few degrees.
    expect(turns.some((turn) => collidesAt(RING_CAPACITY + 1, turn))).toBe(true)
  })

  test('no tile, single or stacked, leaves the 0-100 box', () => {
    for (const members of [1, 2, 5, 8]) {
      const box = spokeTileBox(members)
      for (let index = 0; index < 360; index += 1) {
        const point = spokePoint(index, 360)
        expect(point.x - box.halfWidth).toBeGreaterThan(0)
        expect(point.x + box.halfWidth).toBeLessThan(100)
        expect(point.y - box.halfHeight).toBeGreaterThan(0)
        expect(point.y + box.halfHeight).toBeLessThan(100)
      }
    }
  })
})

/**
 * The capacity against the graph the app actually ships, rather than against a
 * count chosen to make it pass: every element's ring, fully witnessed, has to
 * draw without collisions - which for the crowded ones is grouping's job
 * (`panelModel`), and for the rest is the plain one-tile-per-spoke case.
 */
describe('every ring the roster can draw', () => {
  const notes = entryIndex()
  const witnessed = [...notes.witnessKeys]
  const view = fieldNotesView({ edges: witnessed, reviewed: witnessed.length })
  const degrees = notes.elements.map((name) => notes.entriesFor(name).length)

  test('the roster still has a ring on both sides of the capacity', () => {
    // Without this the two cases below could quietly stop being tested at all.
    expect(Math.max(...degrees)).toBeGreaterThan(RING_CAPACITY)
    expect(Math.min(...degrees)).toBeLessThanOrEqual(RING_CAPACITY)
  })

  test('fits, tiles and stacks alike, under the capacity and over it', () => {
    for (const name of notes.elements) {
      const spokes = ringFor(name, view).spokes
      expect({ name, over: spokes.length <= RING_CAPACITY }).toEqual({ name, over: true })

      const drawn = spokes.map((spoke, index) => ({
        point: spokePoint(index, spokes.length),
        box: spokeTileBox(spoke.group?.members.length ?? 1),
      }))
      for (const [index, one] of drawn.entries()) {
        expect(one.point.x - one.box.halfWidth).toBeGreaterThan(0)
        expect(one.point.x + one.box.halfWidth).toBeLessThan(100)
        expect(one.point.y - one.box.halfHeight).toBeGreaterThan(0)
        expect(one.point.y + one.box.halfHeight).toBeLessThan(100)

        for (const other of drawn.slice(index + 1)) {
          const apart =
            Math.abs(one.point.x - other.point.x) >= one.box.halfWidth + other.box.halfWidth ||
            Math.abs(one.point.y - other.point.y) >= one.box.halfHeight + other.box.halfHeight
          expect({ name, index, apart }).toEqual({ name, index, apart: true })
        }
      }
    }
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
