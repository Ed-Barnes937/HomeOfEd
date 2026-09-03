/**
 * Where the ring's spokes go (spec §6). Pure trigonometry in a 0-100 box, so
 * the same numbers drive the desktop overlay and the phone sheet - the SVG
 * scales with its square container and the tiles, which are absolutely
 * positioned in percentages, come with it.
 *
 * It lives beside the panel rather than inside it because a layout that can be
 * wrong (a spoke behind the centre tile, an arrowhead pointing the wrong way)
 * is worth a vitest case, and none of it needs a DOM.
 */

/** The box everything below is measured in: percentages of the ring's square. */
export const RING = {
  centre: 50,
  radius: 33,
  /** Where a spoke's line starts, clear of the 56px centre tile. */
  centreInset: 8,
  /** Where it stops, clear of the 40px ring tile. */
  tileInset: 6,
  /** How far along the spoke the outcome words sit. */
  outcomeAt: 0.62,
  /** Length of an arrowhead, along the line it sits on. */
  arrow: 3.2,
} as const

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

/** Where a spoke's outcome words and their product tiles sit. */
export function outcomePoint(point: RingPoint): { x: number; y: number } {
  return {
    x: RING.centre + (point.x - RING.centre) * RING.outcomeAt,
    y: RING.centre + (point.y - RING.centre) * RING.outcomeAt,
  }
}

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
