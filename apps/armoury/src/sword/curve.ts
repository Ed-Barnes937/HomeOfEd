/** Points `[u, value]` with u rising from 0 to 1. */
export type Curve = [u: number, value: number][]

/**
 * The value at u by monotone cubic interpolation (Fritsch-Carlson): smooth, never
 * overshooting its points, and flat beyond the first and last point.
 */
export function sample(curve: Curve, u: number): number {
  const n = curve.length
  if (n === 0) return 0
  if (u <= curve[0]![0]) return curve[0]![1]
  if (u >= curve[n - 1]![0]) return curve[n - 1]![1]
  let i = 0
  while (curve[i + 1]![0] < u) i++
  const [u0, v0] = curve[i]!
  const [u1, v1] = curve[i + 1]!
  const h = u1 - u0
  if (h <= 0) return v1
  const t = (u - u0) / h
  const m0 = slopeAt(curve, i)
  const m1 = slopeAt(curve, i + 1)
  const t2 = t * t
  const t3 = t2 * t
  return (
    (2 * t3 - 3 * t2 + 1) * v0 +
    (t3 - 2 * t2 + t) * h * m0 +
    (-2 * t3 + 3 * t2) * v1 +
    (t3 - t2) * h * m1
  )
}

const secant = (curve: Curve, i: number) => {
  const [u0, v0] = curve[i]!
  const [u1, v1] = curve[i + 1]!
  return u1 > u0 ? (v1 - v0) / (u1 - u0) : 0
}

function slopeAt(curve: Curve, i: number): number {
  const last = curve.length - 1
  if (i === 0) return endSlope(secant(curve, 0), last > 1 ? secant(curve, 1) : secant(curve, 0))
  if (i === last)
    return endSlope(secant(curve, last - 1), last > 1 ? secant(curve, last - 2) : secant(curve, 0))
  const a = secant(curve, i - 1)
  const b = secant(curve, i)
  if (a * b <= 0) return 0
  // Harmonic mean of the two secants keeps each piece inside its points.
  return (2 * a * b) / (a + b)
}

function endSlope(near: number, next: number): number {
  const m = (3 * near - next) / 2
  if (m * near <= 0) return 0
  return Math.abs(m) > 3 * Math.abs(near) ? 3 * near : m
}
