import type { GrooveSet, Material, WandSpec } from './compile.ts'
import { RIM_WIDTH } from './gems.ts'

// The wand surface is a radius field r(angle, z) sampled on a cylinder grid.
// Pure functions, no three.js, so they're easy to test.

const TAU = Math.PI * 2

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const RIM_HEIGHT = 0.35
/** Carving comes back over this much wood past a gem's rim, mm. */
const SETTING_FADE = 1.2

/** Angle a minus angle b, wrapped into [-pi, pi). */
const angleBetween = (a: number, b: number) => ((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI

/** How a gem's seat and rim move the surface, how much carving survives there, and how much is metal. */
function settingsAt(spec: WandSpec, theta: number, z: number, r0: number) {
  let offset = 0
  let carving = 1
  let metal = 0
  for (const gem of spec.gems) {
    const outer = gem.radius + RIM_WIDTH
    const dz = z - gem.z
    if (Math.abs(dz) >= outer + SETTING_FADE) continue
    const d = Math.hypot(r0 * angleBetween(theta, gem.theta), dz)
    carving = Math.min(carving, smoothstep(outer, outer + SETTING_FADE, d))
    if (d < gem.radius) {
      offset = -0.3 * gem.radius * Math.sqrt(1 - (d / gem.radius) ** 2)
      if (spec.metalSettings) metal = 1
    } else if (d < outer) {
      offset = RIM_HEIGHT * Math.sin((Math.PI * (d - gem.radius)) / RIM_WIDTH)
      if (spec.metalSettings) metal = 1
    }
  }
  return { offset, carving, metal }
}

function strengthAt(g: GrooveSet, z: number): number {
  if (z <= g.from || z >= g.to) return 0
  return smoothstep(g.from, g.from + g.fadeIn, z) * (1 - smoothstep(g.to - g.fadeOut, g.to, z))
}

/** Final radius, the uncarved profile radius, and how much of the surface is a metal ridge or gem setting, at (angle, z). */
export function radiusAt(
  spec: WandSpec,
  theta: number,
  z: number,
): { r: number; r0: number; metal: number } {
  const r0 = spec.profile(z)
  if (r0 <= 0) return { r: 0, r0: 0, metal: 0 }
  const settings = settingsAt(spec, theta, z, r0)
  let ridgeMetal = 0
  // The deepest cut and the tallest ridge, so overlapping sets combine in any order.
  let cut = r0
  let raised = r0
  const uncarved = spec.zones.some((zone) => zone.uncarved && z >= zone.from && z <= zone.to)
  for (const g of uncarved ? [] : spec.grooves) {
    const f = strengthAt(g, z) * settings.carving
    if (f <= 0) continue
    const spacing = TAU / g.count
    const phase = theta - TAU * g.twist * (z - g.from)
    // Angle from the nearest face or groove centre, in [-spacing/2, spacing/2).
    const a = ((((phase + spacing / 2) % spacing) + spacing) % spacing) - spacing / 2
    if (g.shape === 'flat') {
      // A polygon whose faces sit at depth below the profile. min() of several
      // sets is what turns crossing flats into diamonds.
      cut = Math.min(cut, (r0 * (1 - g.depth * f)) / Math.cos(a))
    } else {
      const x = Math.abs(a) / g.halfWidth
      if (x >= 1) continue
      const offset = r0 * g.depth * f * Math.sqrt(1 - x * x)
      if (g.raised) raised = Math.max(raised, r0 + offset)
      else cut = Math.min(cut, r0 - offset)
      if (g.raised && g.metal)
        ridgeMetal = Math.max(ridgeMetal, (1 - smoothstep(0.82, 0.97, x)) * smoothstep(0, 0.3, f))
    }
  }
  return {
    r: cut + raised - r0 + settings.offset,
    r0,
    metal: Math.max(ridgeMetal, settings.metal),
  }
}

const MATERIAL_CHANNEL: Record<Material, number> = { metal: 0, paint: 1, bone: 2 }

function materialAt(spec: WandSpec, z: number): Material | null {
  let found: Material | null = null
  for (const zone of spec.zones) if (z >= zone.from && z <= zone.to) found = zone.material
  return found
}

export interface WandMeshData {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  /** Per-vertex stain amount, 0 (bare wood) to 1 (fully the stain colour). */
  stain: Float32Array
  /** Per-vertex brightness multiplier that darkens carved grooves. */
  shade: Float32Array
  /** Per-vertex (metal, paint, bone) weights; wood is whatever is left. */
  zone: Float32Array
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
  const { bodyFrom, bodyTo } = spec
  const rings = Math.ceil((bodyTo - bodyFrom) / step)
  const cols = segments + 1 // duplicate seam column for UVs
  const count = (rings + 1) * cols

  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)
  const stainAmount = new Float32Array(count)
  const shade = new Float32Array(count)
  const zone = new Float32Array(count * 3)
  const ridge = new Float32Array(count)
  const depthNorm = new Float32Array(count)

  // Grain runs along the wand. Around it, the texture is mirrored so there's
  // no seam: across goes 0 -> 1 -> 0 over one turn.
  const across = (Math.PI * spec.handleMaxR * 0.8) / textureMm

  for (let j = 0; j <= rings; j++) {
    const z = bodyFrom + ((bodyTo - bodyFrom) * j) / rings
    for (let i = 0; i <= segments; i++) {
      const theta = (TAU * i) / segments
      const { r, r0, metal } = radiusAt(spec, theta, z)
      const k = j * cols + i
      ridge[k] = metal
      positions[k * 3] = r * Math.cos(theta)
      positions[k * 3 + 1] = r * Math.sin(theta)
      positions[k * 3 + 2] = z
      const tri = i <= segments / 2 ? (2 * i) / segments : 2 - (2 * i) / segments
      uvs[k * 2] = across * tri
      uvs[k * 2 + 1] = z / textureMm
      depthNorm[k] = r0 > 0 ? (r0 - r) / r0 : 0
    }
    const material = materialAt(spec, z)
    for (let i = 0; i <= segments; i++) {
      const k = j * cols + i
      if (material) zone[k * 3 + MATERIAL_CHANNEL[material]] = 1
      const m = ridge[k]!
      if (m > 0) {
        zone[k * 3] = Math.max(zone[k * 3]!, m)
        zone[k * 3 + 1] = zone[k * 3 + 1]! * (1 - m)
        zone[k * 3 + 2] = zone[k * 3 + 2]! * (1 - m)
      }
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
    const s = (bodyFrom + ((bodyTo - bodyFrom) * j) / rings) / L
    const amount = stain.colour
      ? stain.strength *
        (1 - smoothstep(stain.reach - stain.softness / 2, stain.reach + stain.softness / 2, s))
      : 0
    for (let i = 0; i <= segments; i++) {
      const k = j * cols + i
      const groove = Math.min(1, Math.max(0, depthNorm[k]!) / 0.12)
      const soaks = 1 - zone[k * 3]! - zone[k * 3 + 1]!
      stainAmount[k] = stain.colour
        ? soaks * Math.min(1, amount + 0.6 * stain.strength * groove)
        : 0
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

  return { positions, normals, uvs, stain: stainAmount, shade, zone, indices, rings, segments }
}

export interface GemPose {
  /** Where the middle of the stone's girdle sits, mm. */
  position: [number, number, number]
  /** The way the stone faces: out of the wand's surface. */
  normal: [number, number, number]
  /** The stone's radius, mm, a little inside its seat. */
  radius: number
}

/** Each set gem's place on the uncarved surface, from the profile and its slope. */
export function gemPoses(spec: WandSpec): GemPose[] {
  return spec.gems.map((gem) => {
    const r = spec.profile(gem.z)
    const slope = (spec.profile(gem.z + 0.25) - spec.profile(gem.z - 0.25)) / 0.5
    const [c, s] = [Math.cos(gem.theta), Math.sin(gem.theta)]
    const len = Math.hypot(1, slope)
    return {
      position: [r * c, r * s, gem.z],
      normal: [c / len, s / len, -slope / len],
      radius: gem.radius * 0.92,
    }
  })
}
