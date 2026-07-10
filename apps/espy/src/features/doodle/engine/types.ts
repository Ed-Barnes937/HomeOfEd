/**
 * Shared engine contracts. PURE TS — no React, no DOM, no Canvas.
 * The drawing is an ordered list of immutable `Op`s; the canvas is a
 * projection of that list (command replay — see spec §3).
 */

export interface Point {
  x: number
  y: number
}
export interface ViewBox {
  width: number
  height: number
} // logical space, see §4

export interface Satellite {
  x: number
  y: number
  r: number
}
export interface Blot {
  cx: number
  cy: number
  r: number
  points: Point[] // resolved outline vertices (logical coords)
  satellites: Satellite[]
}

export interface Stroke {
  color: string // ink hex (v1: always base ink)
  width: number // nib width, logical px
  points: Point[] // polyline, logical coords (>= 1 point)
}

export interface Eye {
  x: number
  y: number // centre, logical coords
  size: number // outer white radius, logical px
  pupilAngle: number // gaze direction, radians [0, 2π)
}

export type Op =
  // clears + lays a fresh field. `blots` seed the ink-in-water sim; `baked` is
  // the settled field raster (PNG/JPEG data URL) once the sim has frozen — the
  // render layer blits it, and it round-trips through session restore.
  | { type: 'field'; viewBox: ViewBox; blots: Blot[]; baked?: string }
  | { type: 'stroke'; stroke: Stroke }
  | { type: 'eye'; eye: Eye }

/** Seedable random source: returns a value in `[0, 1)`. */
export type Rng = () => number
