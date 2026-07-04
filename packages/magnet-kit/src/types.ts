/** An axis-aligned box: the collision primitive the engine operates on. */
export interface Box {
  id: number
  x: number
  y: number
  w: number
  h: number
}

/** A magnet's dimensions, supplied by the caller (the engine owns no sizes). */
export interface Size {
  w: number
  h: number
}

/** Where and how a freshly-spawned magnet should appear (unclamped). */
export interface Placement {
  x: number
  y: number
  rot: number
}
