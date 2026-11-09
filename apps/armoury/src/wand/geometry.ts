import type { GrooveSet, WandSpec } from './compile.ts'

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

/** Final radius and the uncarved profile radius at (angle, z). */
export function radiusAt(spec: WandSpec, theta: number, z: number): { r: number; r0: number } {
  const r0 = spec.profile(z)
  let r = r0
  if (r0 <= 0) return { r: 0, r0: 0 }
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
  return { r, r0 }
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

  // Grain runs along the wand. Around it, the texture is mirrored so there's
  // no seam: across goes 0 -> 1 -> 0 over one turn.
  const across = (Math.PI * spec.handleMaxR * 0.8) / textureMm

  for (let j = 0; j <= rings; j++) {
    const z = (L * j) / rings
    for (let i = 0; i <= segments; i++) {
      const theta = (TAU * i) / segments
      const { r, r0 } = radiusAt(spec, theta, z)
      const k = j * cols + i
      positions[k * 3] = r * Math.cos(theta)
      positions[k * 3 + 1] = r * Math.sin(theta)
      positions[k * 3 + 2] = z
      const tri = i <= segments / 2 ? (2 * i) / segments : 2 - (2 * i) / segments
      uvs[k * 2] = across * tri
      uvs[k * 2 + 1] = z / textureMm
      depthNorm[k] = r0 > 0 ? (r0 - r) / r0 : 0
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
      stainAmount[k] = stain.colour ? Math.min(1, amount + 0.6 * stain.strength * groove) : 0
      shade[k] = 1 - 0.35 * groove
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
