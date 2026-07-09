/**
 * Eye geometry (spec §5.4). PURE TS — RNG injected, no DOM.
 *
 * Only the size and gaze angle are rolled here and frozen into the `Eye`; the
 * pupil/highlight offsets are derived at render time in `surface.ts`.
 */

import type { Eye, Rng } from './types.ts'

/** Default eye size in logical px. */
export const EYE_BASE = 12

/** An eye at `(x, y)`: size = base·[0.85,1.25), gaze angle in [0, 2π). */
export function makeEye(x: number, y: number, base: number, rng: Rng): Eye {
  const size = base * (0.85 + rng() * 0.4)
  const pupilAngle = rng() * Math.PI * 2
  return { x, y, size, pupilAngle }
}
