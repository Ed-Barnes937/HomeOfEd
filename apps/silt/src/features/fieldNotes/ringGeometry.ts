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
  /**
   * Half the outcome words' line box: the 11px text and 1px padding of
   * `.spokeOutcome` (`FieldNotesPanel.module.scss`), in ring units at the 560px
   * desktop ring. Change that rule's font and this number moves with it.
   */
  labelHalfHeight: 1.5,
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

/**
 * The outcome's anchor on the spoke: where the words would sit if nothing were
 * in their way. `labelPoint` is what the panel actually draws them at.
 */
export function outcomePoint(point: RingPoint): { x: number; y: number } {
  return {
    x: RING.centre + (point.x - RING.centre) * RING.outcomeAt,
    y: RING.centre + (point.y - RING.centre) * RING.outcomeAt,
  }
}

/**
 * Where the outcome words and their product tiles actually sit: `outcomePoint`
 * stepped across the line, so the words stop covering the arrowhead that says
 * which end of the edge is the product.
 *
 * The words are a wide, short box that does not turn with the spoke, so how
 * much of the line they hide depends entirely on the angle. Near the vertical
 * their short side lies along the line and the arrowheads are well clear -
 * those labels keep exactly the place they had, which is why the step scales by
 * `|ux|`. Near the horizontal the box lies *along* the line and reaches an
 * arrowhead however long or short the words are: the way out is across the
 * line, not along it, so the label's width does not come into it.
 *
 * The side to step to is the one the spoke's outward end is not on - an
 * ascending spoke's words drop below its line, a descending one's rise above
 * it. Stepping the other way would carry the box over the outward head instead
 * of away from it.
 *
 * The product tiles ride along, because they hang off this same point. They
 * hang *below* it whatever the spoke does, though, which is a placement of
 * their own: on a downward spoke they have always sat close to the outward head
 * and they still do. The step never leaves them closer to one than that
 * (`ringGeometry.test.ts` pins the floor); giving them a side of their own is a
 * change to how the panel draws them, not to where this point is.
 */
export function labelPoint(point: RingPoint): { x: number; y: number } {
  const anchor = outcomePoint(point)
  // Half the words plus a whole arrowhead: at the horizontal, where the step is
  // at its longest, that clears the head's tip and the body behind it.
  const step = (RING.labelHalfHeight + RING.arrow) * Math.abs(point.ux)
  const side = -(Math.sign(point.ux) || 1) * (Math.sign(point.uy) || 1)
  return {
    x: anchor.x + side * -point.uy * step,
    y: anchor.y + side * point.ux * step,
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
