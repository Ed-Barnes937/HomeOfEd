import { describe, expect, test } from 'vitest'

import { entryIndex } from './entries.ts'
import { fieldNotesView } from './fieldNotesView.ts'
import { ringFor } from './panelModel.ts'
import {
  arrowPoints,
  labelPoint,
  outcomePoint,
  RING,
  RING_CAPACITY,
  spokeLine,
  spokePoint,
  spokeTileBox,
  tileSide,
  type RingPoint,
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

/** Ring units to the CSS pixel, at the 560px desktop ring. */
const UNIT = 5.6

/**
 * The outcome label as `.spokeOutcome` draws it (FieldNotesPanel.module.scss):
 * an axis-aligned box of words centred on its point, which does not turn with
 * the spoke. Widths are in ring units, so 4 is one short word and 16 is the
 * longest outcome the roster can spell - "sulphur + water".
 */
const LABEL_WIDTHS = [4, 8, 12, 16]

/**
 * The product tiles as `.spokeTiles` draws them: an 18px row translated 10px
 * off the label's point, hanging 1.8 to 5.0 ring units from it. A spoke
 * carries one or two - no entry in the graph has more than two products, and
 * none has more than two reagents. Which *side* of the point they take is
 * `tileSide`'s (ticket 17).
 */
const TILES = {
  top: 10 / UNIT,
  bottom: 28 / UNIT,
  widths: [18 / UNIT, (18 * 2 + 3) / UNIT],
}

/**
 * The room an arrowhead wants: the whole head, not just the point of it. The
 * triangle runs `RING.arrow` back from its tip and its base corners sit a shade
 * further out than that, so anything this clear of the tip is clear of the head.
 */
const TIP_ROOM = RING.arrow

interface Box {
  x: number
  y: number
  halfWidth: number
  halfHeight: number
}

function wordsBox(anchor: { x: number; y: number }, width: number): Box {
  return { x: anchor.x, y: anchor.y, halfWidth: width / 2, halfHeight: RING.labelHalfHeight }
}

function tilesBox(anchor: { x: number; y: number }, width: number, side = 1): Box {
  return {
    x: anchor.x,
    y: anchor.y + (side * (TILES.top + TILES.bottom)) / 2,
    halfWidth: width / 2,
    halfHeight: (TILES.bottom - TILES.top) / 2,
  }
}

/** The tiles where the panel actually draws them: `labelPoint`, on `tileSide`. */
function drawnTilesBox(point: RingPoint, width: number): Box {
  return tilesBox(labelPoint(point), width, tileSide(point))
}

function labelBox(point: RingPoint, width: number): Box {
  return wordsBox(labelPoint(point), width)
}

/** How far a point sits outside a box - 0 once it is inside one. */
function gapTo(box: Box, to: { x: number; y: number }): number {
  return Math.hypot(
    Math.max(Math.abs(to.x - box.x) - box.halfWidth, 0),
    Math.max(Math.abs(to.y - box.y) - box.halfHeight, 0),
  )
}

/**
 * Both ends of the spoke's visible line, which is where the panel puts an
 * arrowhead's tip - outwards at `to`, inwards at `from`. Only one of them is
 * drawn per spoke, but the label knows nothing of direction, so it clears both.
 */
function arrowTips(point: RingPoint): Array<{ x: number; y: number }> {
  const { from, to } = spokeLine(point)
  return [from, to]
}

/** How far the label stepped off its anchor on the line. */
function stepOf(point: RingPoint): number {
  const label = labelPoint(point)
  const anchor = outcomePoint(point)
  return Math.hypot(label.x - anchor.x, label.y - anchor.y)
}

/** The nearest either arrowhead comes to a box. */
function tipGap(box: Box, point: RingPoint): number {
  return Math.min(...arrowTips(point).map((tip) => gapTo(box, tip)))
}

/** The length of the spoke's visible line a box draws over. */
function coveredRun(box: Box, point: RingPoint): number {
  const { from, to } = spokeLine(point)
  const steps = 2000
  let covered = 0
  const run = Math.hypot(to.x - from.x, to.y - from.y)
  for (let index = 0; index < steps; index += 1) {
    const along = (index + 0.5) / steps
    const at = { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along }
    if (gapTo(box, at) === 0) covered += run / steps
  }
  return covered
}

describe('outcome labels step clear of the arrowheads', () => {
  test('at every angle, and for any outcome the roster can spell', () => {
    for (let index = 0; index < 360; index += 1) {
      const point = spokePoint(index, 360)
      for (const width of LABEL_WIDTHS) {
        const clear = tipGap(labelBox(point, width), point) >= TIP_ROOM - 1e-9
        expect({ index, width, clear }).toEqual({ index, width, clear: true })
      }
    }
  })

  test("the two o'clock spoke from the screenshot, where the words sat on the head", () => {
    // Six spokes puts one at two o'clock exactly - the reported angle.
    const point = spokePoint(1, 6)
    const width = 13 // "both consumed", near enough

    // What the panel used to draw: the words centred on the line, close enough
    // to the outward tip to sit over the head that hangs behind it.
    expect(gapTo(wordsBox(outcomePoint(point), width), spokeLine(point).to)).toBeLessThan(TIP_ROOM)

    expect(gapTo(labelBox(point, width), spokeLine(point).to)).toBeGreaterThanOrEqual(TIP_ROOM)
  })

  test('a spoke near the vertical keeps its label where it always was', () => {
    for (const point of [spokePoint(0, 4), spokePoint(2, 4)]) {
      expect(labelPoint(point).x).toBeCloseTo(outcomePoint(point).x, 6)
      expect(labelPoint(point).y).toBeCloseTo(outcomePoint(point).y, 6)
    }

    // And it is a gentle thing a few degrees off the vertical too, not a jump:
    // ten degrees of spoke buys a step of under a pixel and a half.
    for (const index of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      for (const point of [spokePoint(index, 360), spokePoint(180 + index, 360)]) {
        expect(stepOf(point)).toBeLessThan(1)
      }
    }
  })

  test('the words stay on their own spoke: a step across the line, never a leap off it', () => {
    for (let index = 0; index < 360; index += 1) {
      const point = spokePoint(index, 360)
      // Never further than the step itself, and still between the two tiles.
      expect(stepOf(point)).toBeLessThanOrEqual(RING.labelHalfHeight + RING.arrow + 1e-9)
      const reach = Math.hypot(labelPoint(point).x - RING.centre, labelPoint(point).y - RING.centre)
      expect(reach).toBeGreaterThan(RING.centreInset)
      expect(reach).toBeLessThan(RING.radius - RING.tileInset)

      // And the words never hide more than a couple of arrowheads' worth of it.
      for (const width of LABEL_WIDTHS) {
        expect(coveredRun(labelBox(point, width), point)).toBeLessThan(RING.arrow * 2)
      }
    }
  })

  test('that bound is a real one: on the horizontal the words used to swallow the line', () => {
    const threeOclock = spokePoint(1, 4)
    const swallowed = coveredRun(wordsBox(outcomePoint(threeOclock), 13), threeOclock)

    expect(swallowed).toBeGreaterThan(RING.arrow * 2)
    // Stepped off it, they hide none of that spoke at all.
    expect(coveredRun(labelBox(threeOclock, 13), threeOclock)).toBe(0)
  })

  test('the product tiles ride along, no closer to a head than they have always sat', () => {
    // The tiles used to hang below their point whatever the spoke did, so the
    // six o'clock spoke held them out towards its own outward head. That
    // clearance is the floor ticket 10 pinned, and nothing since digs below it.
    const sixOclock = spokePoint(2, 4)

    for (const width of TILES.widths) {
      const floor = tipGap(tilesBox(outcomePoint(sixOclock), width), sixOclock)
      expect(floor).toBeGreaterThan(0)

      for (let index = 0; index < 360; index += 1) {
        const point = spokePoint(index, 360)
        const gap = tipGap(drawnTilesBox(point, width), point)
        expect({ index, width, kept: gap >= floor - 1e-9 }).toEqual({ index, width, kept: true })
      }
    }
  })
})

/**
 * Ticket 17, absorbed into 09: the tiles get a side of their own, so they stop
 * sitting on the outward arrowhead of a downward spoke - the one place the old
 * fixed "below the point" placement put them right on top of a head.
 */
describe('the product tiles take the side away from the heads (ticket 17)', () => {
  test('at every angle, the tiles clear both arrowheads by a whole head', () => {
    for (let index = 0; index < 360; index += 1) {
      const point = spokePoint(index, 360)
      for (const width of TILES.widths) {
        const clear = tipGap(drawnTilesBox(point, width), point) >= TIP_ROOM - 1e-9
        expect({ index, width, clear }).toEqual({ index, width, clear: true })
      }
    }
  })

  test('a downward spoke lifts them above the point; an upward one keeps them below', () => {
    expect(tileSide(spokePoint(2, 4))).toBe(-1) // six o'clock, pointing down
    expect(tileSide(spokePoint(0, 4))).toBe(1) // twelve o'clock, pointing up
    // The horizontal has no outward head above or below it, so it takes the
    // same side the words stepped to rather than a coin toss.
    expect(tileSide(spokePoint(1, 4))).toBe(-1)
    expect(tileSide(spokePoint(3, 4))).toBe(-1)
  })

  test('the old fixed placement really did sit on the six o\'clock head', () => {
    const sixOclock = spokePoint(2, 4)
    const width = TILES.widths[1]!

    expect(tipGap(tilesBox(labelPoint(sixOclock), width), sixOclock)).toBeLessThan(TIP_ROOM)
    expect(tipGap(drawnTilesBox(sixOclock, width), sixOclock)).toBeGreaterThanOrEqual(TIP_ROOM)
  })
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
