/**
 * Where the ring's spokes go (spec §6). Pure trigonometry in a 0-100 box, so
 * the same numbers drive the desktop overlay and the phone sheet - the SVG
 * scales with its square container and the tiles, which are absolutely
 * positioned in percentages, come with it.
 *
 * It lives beside the panel rather than inside it because a layout that can be
 * wrong (a spoke behind the centre tile, an arrowhead pointing the wrong way)
 * is worth a vitest case, and none of it needs a DOM.
 *
 * There is no label arithmetic here any more. Ticket 10 spent a module on
 * stepping outcome words clear of the arrowheads; ticket 20's measurement then
 * found the words could never fit at all - about 10.4 arc units of room per
 * spoke at the ring's capacity, against labels half again as wide - so ticket 25
 * moved every word into the reading line under the ring and the ring became
 * icons and arrowheads. What is left is the geometry the drawing still needs.
 */

/** The box everything below is measured in: percentages of the ring's square. */
export const RING = {
  centre: 50,
  radius: 33,
  /** Where a spoke's line starts, clear of the 56px centre tile. */
  centreInset: 8,
  /** Where it stops, clear of the 40px ring tile. */
  tileInset: 6,
  /** Length of an arrowhead, along the line it sits on. */
  arrow: 3.2,
} as const

/**
 * The pixels the ring is drawn at when it is at its smallest, which is what
 * turns a tile size into ring units. A ring tile is a fixed number of *pixels*
 * while the ring itself is a box of percentages, so the smaller the ring the
 * more of it a tile covers: a capacity derived from the roomier layout would
 * crowd the tighter one, and everything below is therefore worked out at the
 * floor.
 *
 * **It is a floor the stylesheet is held to, not a size it writes down.** The
 * desktop ring is a fixed 560px and the phone sheet's takes the room it is in
 * (ticket 21), so the sheet is the one that could go under - which is why the
 * panel hands this number to `.ring` as `--ring-min` rather than the stylesheet
 * repeating it. A phone with less room than this scrolls; it does not draw a
 * ring whose tiles overlap.
 */
export const RING_MIN_PX = 340

/**
 * What a spoke draws at its ring point, in CSS pixels: one tile (spec §6), or
 * the grouped stack of smaller ones that replaces it (ticket 09).
 *
 * **The panel draws from these, rather than repeating them.** The capacity
 * below is only honest if the tiles really are this size and the stack really
 * wraps at this column, so `FieldNotesPanel` takes its tile sizes from here and
 * hands the two the stylesheet needs (`columns`, `gap`) to `.spokeStack` as
 * custom properties.
 */
export const RING_TILES = { spoke: 40, member: 18, gap: 3, columns: 2 } as const

/** CSS pixels as ring units, at the smallest ring the panel draws. */
function units(px: number): number {
  return (px / RING_MIN_PX) * 100
}

export interface RingPoint {
  /** The ring tile's centre. */
  x: number
  y: number
  /** The unit vector from the ring's centre to it. */
  ux: number
  uy: number
}

export interface Segment {
  from: { x: number; y: number }
  to: { x: number; y: number }
}

/**
 * `count` points evenly spaced around the ring, the first at twelve o'clock and
 * the rest clockwise - so a chart with one witnessed entry always draws it in
 * the same place, and adding a second moves both predictably.
 */
export function spokePoint(index: number, count: number): RingPoint {
  const angle = ((-90 + (index * 360) / Math.max(count, 1)) * Math.PI) / 180
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  return {
    x: RING.centre + RING.radius * ux,
    y: RING.centre + RING.radius * uy,
    ux,
    uy,
  }
}

/** The visible run of a spoke: from clear of the centre tile to clear of the ring one. */
export function spokeLine(point: RingPoint): Segment {
  return {
    from: {
      x: RING.centre + point.ux * RING.centreInset,
      y: RING.centre + point.uy * RING.centreInset,
    },
    to: {
      x: point.x - point.ux * RING.tileInset,
      y: point.y - point.uy * RING.tileInset,
    },
  }
}

/**
 * Half the box a spoke draws at its ring point: one 40px tile, or the grouped
 * stack of `members` 18px tiles that replaces it (ticket 09). In ring units at
 * the smallest ring, so a box that fits here fits on the desktop too.
 */
export function spokeTileBox(members: number): { halfWidth: number; halfHeight: number } {
  if (members <= 1) {
    const half = units(RING_TILES.spoke) / 2
    return { halfWidth: half, halfHeight: half }
  }

  const span = (count: number): number =>
    units(count * RING_TILES.member + (count - 1) * RING_TILES.gap) / 2
  return {
    halfWidth: span(Math.min(members, RING_TILES.columns)),
    halfHeight: span(Math.ceil(members / RING_TILES.columns)),
  }
}

/**
 * Whether `count` ring tiles, evenly spaced, still clear each other.
 *
 * A tile is an axis-aligned square that does not turn with the ring, so two
 * neighbours miss each other only if they are a whole tile apart on *one* axis.
 * Their separation is a chord, and the worst chord for that test is the one
 * lying at 45 degrees, whose whole length buys only `1/root 2` of itself on
 * either axis - so a chord of a tile's width times root 2 is what a ring needs
 * at every rotation, not just the ones that happen to line up.
 */
function tilesFit(count: number): boolean {
  if (count < 2) return true
  const chord = 2 * RING.radius * Math.sin(Math.PI / count)
  return chord >= units(RING_TILES.spoke) * Math.SQRT2 - 1e-9
}

/**
 * The most spokes a ring can draw one tile each for (ticket 09) - a dozen, on
 * today's numbers. Derived rather than written down: it moves when the tile
 * size, the radius or the phone's ring does, which is the whole reason the
 * panel asks a geometry module instead of carrying a number of its own. A ring
 * with more witnessed entries than this groups them (`panelModel.groupRing`).
 */
export const RING_CAPACITY = ((): number => {
  let count = 1
  while (count < 360 && tilesFit(count + 1)) count += 1
  return count
})()

/**
 * An SVG triangle with its tip at (x, y), pointing along the unit vector
 * (dx, dy) - the arrowhead that says which end of the edge is the product.
 */
export function arrowPoints(x: number, y: number, dx: number, dy: number): string {
  const baseX = x - dx * RING.arrow
  const baseY = y - dy * RING.arrow
  const wingX = -dy * RING.arrow * 0.55
  const wingY = dx * RING.arrow * 0.55
  return `${x},${y} ${baseX + wingX},${baseY + wingY} ${baseX - wingX},${baseY - wingY}`
}
