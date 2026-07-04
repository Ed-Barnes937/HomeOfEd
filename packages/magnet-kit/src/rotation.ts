/**
 * The angle (degrees) from a magnet's centre to the pointer, with the knob
 * pointing straight up = 0°. atan2(py-cy, px-cx)*180/PI + 90.
 */
export function knobRotation(cx: number, cy: number, px: number, py: number): number {
  return (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90
}

/**
 * Normalise `rot` to [0,360) FIRST (always, snap or not — the prototype does
 * this on every release), then snap to the nearest multiple of 90 (mod 360)
 * when the delta is strictly less than `within`; otherwise return the
 * normalised value unchanged.
 */
export function snapRotation(rot: number, within = 7): number {
  const r = ((rot % 360) + 360) % 360
  const near = Math.round(r / 90) * 90
  return Math.abs(r - near) < within ? near % 360 : r
}

/**
 * Nudge rotation by one wheel tick: rot + step * Math.sign(deltaY). Deliberate
 * micro-divergence from the prototype: deltaY === 0 is a no-op here
 * (sign(0) === 0), where the prototype rotated -7°.
 */
export function wheelRotation(rot: number, deltaY: number, step = 7): number {
  return rot + step * Math.sign(deltaY)
}
