import { seededRandom } from '../engine/schema.ts'
import type { BranchSpec, GrooveSet, WandSpec } from './compile.ts'

// The wand surface is a radius field r(angle, z) sampled on a cylinder grid.
// Pure functions, no three.js, so they're easy to test.

const TAU = Math.PI * 2

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function strengthAt(g: GrooveSet, z: number): number {
  if (z <= g.from || z >= g.to) return 0
  return smoothstep(g.from, g.from + g.fadeIn, z) * (1 - smoothstep(g.to - g.fadeOut, g.to, z))
}

// SPIKE (ticket 02): low-frequency lumps, periodic in angle, seeded per branch.
interface Lump {
  m: number
  k: number
  phase: number
  amp: number
}
const lumpCache = new Map<number, Lump[]>()
function lumpsFor(seed: number): Lump[] {
  let lumps = lumpCache.get(seed)
  if (!lumps) {
    const rand = seededRandom(seed * 104729 + 17)
    lumps = [
      { m: 0, k: TAU / (55 + 40 * rand()), phase: TAU * rand(), amp: 0.45 },
      { m: 1, k: TAU / (70 + 50 * rand()), phase: TAU * rand(), amp: 0.35 },
      { m: 2, k: TAU / (40 + 30 * rand()), phase: TAU * rand(), amp: 0.25 },
      { m: 3, k: TAU / (25 + 20 * rand()), phase: TAU * rand(), amp: 0.12 },
    ]
    lumpCache.set(seed, lumps)
  }
  return lumps
}

function lumpAt(b: BranchSpec, theta: number, z: number): number {
  if (b.gnarl <= 0) return 0
  let n = 0
  for (const l of lumpsFor(b.seed)) n += l.amp * Math.sin(l.m * theta + l.k * z + l.phase)
  return b.gnarl * n
}

/** Knot bump height (mm) and how much of a knot's rim this point is on, 0 to 1. */
function knotAt(b: BranchSpec, theta: number, z: number, r0: number): { h: number; rim: number } {
  let h = 0
  let rim = 0
  for (const k of b.knots) {
    const dz = z - k.z
    if (Math.abs(dz) > k.width * 3) continue
    const dTheta = ((((theta - k.theta + Math.PI) % TAU) + TAU) % TAU) - Math.PI
    const d = Math.hypot(r0 * dTheta, dz) / k.width
    if (d > 3) continue
    // A raised boss with a dimple where the twig was, and a rim the stain soaks into.
    h += k.height * (Math.exp(-d * d) - 0.55 * Math.exp(-((d / 0.38) ** 2)))
    rim = Math.max(rim, Math.exp(-(((d - 0.9) / 0.35) ** 2)), Math.exp(-((d / 0.3) ** 2)))
  }
  return { h, rim }
}

/** Final radius and the uncarved profile radius at (angle, z). */
export function radiusAt(
  spec: WandSpec,
  theta: number,
  z: number,
): { r: number; r0: number; knot: number } {
  const base = spec.profile(z)
  if (base <= 0) return { r: 0, r0: 0, knot: 0 }
  const r0 = base * (1 + lumpAt(spec.branch, theta, z))
  let r = r0
  for (const g of spec.grooves) {
    const f = strengthAt(g, z)
    if (f <= 0) continue
    const spacing = TAU / g.count
    const phase = theta - TAU * g.twist * (z - g.from)
    // Angle from the nearest face or groove centre, in [-spacing/2, spacing/2).
    const a = ((((phase + spacing / 2) % spacing) + spacing) % spacing) - spacing / 2
    if (g.shape === 'flat') {
      // A polygon whose faces sit at depth below the profile. min() of several
      // sets is what turns crossing flats into diamonds.
      r = Math.min(r, (r0 * (1 - g.depth * f)) / Math.cos(a))
    } else {
      const x = Math.abs(a) / g.halfWidth
      if (x < 1) r = Math.min(r, r0 * (1 - g.depth * f * Math.sqrt(1 - x * x)))
    }
  }
  const knot = knotAt(spec.branch, theta, z, r0)
  return { r: r + knot.h, r0, knot: knot.rim }
}

/**
 * SPIKE (ticket 02): the spine's sideways offset at z, mm. A bow plus a few
 * wiggles, less the straight line between its ends so pommel and tip stay on
 * the wand's axis.
 */
export function spineOffset(b: BranchSpec, L: number, z: number): [number, number] {
  const raw = (zz: number): [number, number] => {
    const u = zz / L
    // Bow peaks a little nearer the tip than the middle; smooth so curvature stays bounded at the ends.
    const bow = b.bendMm * (Math.sin(Math.PI * u) - 0.2 * Math.sin(TAU * u))
    let x = bow * Math.cos(b.bendDir)
    let y = bow * Math.sin(b.bendDir)
    if (b.wiggleMm > 0) {
      const rand = seededRandom(b.seed * 31 + 5)
      // Wiggles grow from nothing at the butt; the handle stays mostly true.
      const env = smoothstep(0, 0.4, u)
      for (let i = 0; i < 3; i++) {
        const f = 2 + i + rand()
        const dir = TAU * rand()
        const w = b.wiggleMm * (2 / f) ** 2 * env * Math.sin(TAU * f * u + TAU * rand())
        x += w * Math.cos(dir)
        y += w * Math.sin(dir)
      }
    }
    return [x, y]
  }
  const [x0, y0] = raw(0)
  const [x1, y1] = raw(L)
  const [x, y] = raw(z)
  const t = z / L
  return [x - (x0 + (x1 - x0) * t), y - (y0 + (y1 - y0) * t)]
}

/** Spine point and frame at z: the straight wand's (x, y, z) maps to p + x*n + y*b. */
export function spineFrame(spec: WandSpec, z: number) {
  const L = spec.lengthMm
  const h = 0.25
  const [x, y] = spineOffset(spec.branch, L, z)
  const [xa, ya] = spineOffset(spec.branch, L, Math.max(0, z - h))
  const [xb, yb] = spineOffset(spec.branch, L, Math.min(L, z + h))
  const dz = Math.min(L, z + h) - Math.max(0, z - h)
  let tx = (xb - xa) / dz,
    ty = (yb - ya) / dz,
    tz = 1
  const tl = Math.hypot(tx, ty, tz)
  tx /= tl
  ty /= tl
  tz /= tl
  // Gram-Schmidt from world x; fine while the spine never turns near x, which gentle bends don't.
  let nx = 1 - tx * tx,
    ny = -tx * ty,
    nz = -tx * tz
  const nl = Math.hypot(nx, ny, nz)
  nx /= nl
  ny /= nl
  nz /= nl
  const bx = ty * nz - tz * ny,
    by = tz * nx - tx * nz,
    bz = tx * ny - ty * nx
  return { p: [x, y, z], t: [tx, ty, tz], n: [nx, ny, nz], b: [bx, by, bz] }
}

export interface WandMeshData {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  /** Per-vertex stain amount, 0 (bare wood) to 1 (fully the stain colour). */
  stain: Float32Array
  /** Per-vertex brightness multiplier that darkens carved grooves. */
  shade: Float32Array
  indices: Uint32Array
  rings: number
  segments: number
}

export interface MeshOptions {
  segments?: number
  stepMm?: number
  /** Physical size the wood texture covers, mm. */
  textureMm?: number
}

/**
 * Builds a closed, solid mesh. The profile is zero at both ends, so the first
 * and last rings collapse onto the axis and seal the shape.
 */
export function buildWandMesh(spec: WandSpec, opts: MeshOptions = {}): WandMeshData {
  const segments = opts.segments ?? 256
  const step = opts.stepMm ?? 0.5
  const textureMm = opts.textureMm ?? 110
  const L = spec.lengthMm
  const rings = Math.ceil(L / step)
  const cols = segments + 1 // duplicate seam column for UVs
  const count = (rings + 1) * cols

  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)
  const stainAmount = new Float32Array(count)
  const shade = new Float32Array(count)
  const depthNorm = new Float32Array(count)
  const knotRim = new Float32Array(count)
  const bent = spec.branch.bendMm > 0 || spec.branch.wiggleMm > 0

  // Grain runs along the wand. Around it, the texture is mirrored so there's
  // no seam: across goes 0 -> 1 -> 0 over one turn.
  const across = (Math.PI * spec.handleMaxR * 0.8) / textureMm

  for (let j = 0; j <= rings; j++) {
    const z = (L * j) / rings
    const f = bent ? spineFrame(spec, z) : null
    for (let i = 0; i <= segments; i++) {
      const theta = (TAU * i) / segments
      const { r, r0, knot } = radiusAt(spec, theta, z)
      const k = j * cols + i
      const lx = r * Math.cos(theta)
      const ly = r * Math.sin(theta)
      if (f) {
        // Bend after building: the straight ring is carried onto the spine's frame at z.
        positions[k * 3] = f.p[0]! + lx * f.n[0]! + ly * f.b[0]!
        positions[k * 3 + 1] = f.p[1]! + lx * f.n[1]! + ly * f.b[1]!
        positions[k * 3 + 2] = f.p[2]! + lx * f.n[2]! + ly * f.b[2]!
      } else {
        positions[k * 3] = lx
        positions[k * 3 + 1] = ly
        positions[k * 3 + 2] = z
      }
      knotRim[k] = knot
      const tri = i <= segments / 2 ? (2 * i) / segments : 2 - (2 * i) / segments
      uvs[k * 2] = across * tri
      uvs[k * 2 + 1] = z / textureMm
      depthNorm[k] = r0 > 0 ? Math.max(0, (r0 - r) / r0) : 0
    }
  }

  // Normals by central differences on the grid, wrapping around the seam so
  // both seam columns get identical normals.
  const at = (i: number, j: number) => (j * cols + (((i % segments) + segments) % segments)) * 3
  for (let j = 0; j <= rings; j++) {
    const jp = Math.min(rings, j + 1)
    const jm = Math.max(0, j - 1)
    for (let i = 0; i <= segments; i++) {
      const a = at(i + 1, j),
        b = at(i - 1, j),
        c = at(i, jp),
        d = at(i, jm)
      const p = (n: number) => positions[n]!
      const tx = p(a) - p(b),
        ty = p(a + 1) - p(b + 1),
        tz = p(a + 2) - p(b + 2)
      const sx = p(c) - p(d),
        sy = p(c + 1) - p(d + 1),
        sz = p(c + 2) - p(d + 2)
      let nx = ty * sz - tz * sy
      let ny = tz * sx - tx * sz
      let nz = tx * sy - ty * sx
      let len = Math.hypot(nx, ny, nz)
      if (len < 1e-9) {
        // On the axis at either end: point straight out of the end.
        nx = 0
        ny = 0
        nz = j === 0 ? -1 : 1
        len = 1
      }
      const k = (j * cols + i) * 3
      normals[k] = nx / len
      normals[k + 1] = ny / len
      normals[k + 2] = nz / len
    }
  }

  // Stain amount: strongest at the pommel, fading up the wand, and pooling in
  // carved grooves. The material soaks in this much of a full coat. Grooves
  // are also shaded darker, stained or not.
  const { stain } = spec
  for (let j = 0; j <= rings; j++) {
    const s = j / rings
    const amount = stain.colour
      ? stain.strength *
        (1 - smoothstep(stain.reach - stain.softness / 2, stain.reach + stain.softness / 2, s))
      : 0
    for (let i = 0; i <= segments; i++) {
      const k = j * cols + i
      const groove = Math.min(1, depthNorm[k]! / 0.12)
      const knot = spec.branch.knotStain ? knotRim[k]! : 0
      stainAmount[k] = stain.colour
        ? Math.min(1, amount + 0.6 * stain.strength * groove + 0.7 * stain.strength * knot)
        : 0
      shade[k] = 1 - 0.35 * groove - 0.3 * knot
    }
  }

  const indices = new Uint32Array(rings * segments * 6)
  let n = 0
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * cols + i
      const b = a + 1
      const c = a + cols
      const d = c + 1
      indices[n++] = a
      indices[n++] = b
      indices[n++] = d
      indices[n++] = a
      indices[n++] = d
      indices[n++] = c
    }
  }

  return { positions, normals, uvs, stain: stainAmount, shade, indices, rings, segments }
}
