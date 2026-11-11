import type { SwordSpec } from './compile.ts'

// The curved blade's centre line: light and three-free, so the outline (main chunk) and the
// mesh share one bend.

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const bladeLength = (spec: SwordSpec) => spec.blade.to - spec.blade.from
const uOf = (spec: SwordSpec, z: number) => clamp((z - spec.blade.from) / bladeLength(spec), 0, 1)

const CURVE_SAMPLES = 1024
const FIT_SAMPLES = 96
interface Bend {
  /** Tangent angle toward the spine at u is k * u^(p + 1). */
  k: number
  p: number
  x: Float64Array
  z: Float64Array
}
/** The last few fits, so dragging a slider never grows this without bound. */
const bends = new Map<string, Bend>()
const KEPT_BENDS = 8

/** Lays the bent centre line out by arc length (Simpson's rule per step), for a given angle law. */
function layOut(k: number, p: number, B: number, samples: number): Bend {
  const x = new Float64Array(samples + 1)
  const z = new Float64Array(samples + 1)
  const ds = B / samples
  const angle = (u: number) => k * Math.pow(u, p + 1)
  for (let i = 1; i <= samples; i++) {
    const a = angle((i - 1) / samples)
    const m = angle((i - 0.5) / samples)
    const b = angle(i / samples)
    x[i] = x[i - 1]! - (ds * (Math.sin(a) + 4 * Math.sin(m) + Math.sin(b))) / 6
    z[i] = z[i - 1]! + (ds * (Math.cos(a) + 4 * Math.cos(m) + Math.cos(b))) / 6
  }
  return { k, p, x, z }
}

/** The deepest distance off the shoulder-to-tip chord, and the u where it falls (refined between samples). */
function sagitta(bend: Bend): [depth: number, at: number] {
  const n = bend.x.length - 1
  const cx = bend.x[n]!
  const cz = bend.z[n]!
  const len = Math.hypot(cx, cz)
  const off = (i: number) => Math.abs(bend.x[i]! * cz - bend.z[i]! * cx) / len
  let best = 0
  for (let i = 1; i <= n; i++) if (off(i) > off(best)) best = i
  if (best === 0 || best === n) return [off(best), best / n]
  const [a, b, c] = [off(best - 1), off(best), off(best + 1)]
  const shift = (a - c) / (2 * (a - 2 * b + c))
  return [b - ((a - c) * shift) / 4, (best + shift) / n]
}

/** The angle law whose sagitta is `depth` at `peak`: curvature grows as u^p, so a later peak bends harder near the tip. */
function bendFor(B: number, depth: number, peak: number): Bend {
  const key = `${B}|${depth}|${peak}`
  const cached = bends.get(key)
  if (cached) return cached
  const fitK = (p: number) => {
    let lo = 0
    let hi = 2.5
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (sagitta(layOut(mid, p, B, FIT_SAMPLES))[0] < depth) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  const peakOf = (p: number) => sagitta(layOut(fitK(p), p, B, FIT_SAMPLES))[1]
  let lo = 0
  let hi = 12
  if (peakOf(0) >= peak) hi = 0
  for (let i = 0; i < 16 && hi > 0; i++) {
    const mid = (lo + hi) / 2
    if (peakOf(mid) < peak) lo = mid
    else hi = mid
  }
  const bend = layOut(fitK(hi), hi, B, CURVE_SAMPLES)
  bends.set(key, bend)
  if (bends.size > KEPT_BENDS) bends.delete(bends.keys().next().value!)
  return bend
}

export interface CentreLine {
  /** Bent position in the blade plane, mm. */
  x: number
  z: number
  /** Tangent angle toward the spine, radians. */
  angle: number
  /** Per mm along the blade. */
  curvature: number
}

/**
 * The blade's centre line at straight z: bent toward the spine with zero offset and slope at
 * the shoulder, keeping its length along the curve, so the sagitta off the shoulder-to-tip
 * chord is `curve.depthMm` at u = `curve.peak`.
 */
export function centreLineAt(spec: SwordSpec, z: number): CentreLine {
  const c = spec.blade.curve
  const { from } = spec.blade
  if (!c || c.depthMm <= 0 || z <= from) return { x: 0, z, angle: 0, curvature: 0 }
  const B = bladeLength(spec)
  const bend = bendFor(B, c.depthMm, c.peak)
  const u = uOf(spec, z)
  const f = u * CURVE_SAMPLES
  const i = Math.min(CURVE_SAMPLES - 1, Math.floor(f))
  const t = f - i
  return {
    x: lerp(bend.x[i]!, bend.x[i + 1]!, t),
    z: from + lerp(bend.z[i]!, bend.z[i + 1]!, t),
    angle: bend.k * Math.pow(u, bend.p + 1),
    curvature: (bend.k * (bend.p + 1) * Math.pow(u, bend.p)) / B,
  }
}
