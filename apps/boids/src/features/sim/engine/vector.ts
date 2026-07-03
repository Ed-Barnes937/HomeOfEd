/** Pure 2D vector ops. No mutation — every function returns a new Vec2. */
export interface Vec2 {
  x: number
  y: number
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s }
}

export function magnitude(a: Vec2): number {
  return Math.hypot(a.x, a.y)
}

/** Scale `a` to `mag`, preserving direction. The zero vector stays zero. */
export function setMagnitude(a: Vec2, mag: number): Vec2 {
  const m = magnitude(a)
  return m === 0 ? { x: 0, y: 0 } : scale(a, mag / m)
}

/** Clamp `a`'s magnitude to at most `max`, preserving direction. */
export function limit(a: Vec2, max: number): Vec2 {
  return magnitude(a) > max ? setMagnitude(a, max) : a
}
