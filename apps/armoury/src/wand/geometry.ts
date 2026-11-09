import type { BranchSpec, GrooveSet, Material, StencilBand, WandSpec } from './compile.ts'
import { RIM_WIDTH, SHOWN_SIDE } from './gems.ts'
import { stencilHeight } from './stencils.ts'

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

/** What a gem setting does at one point; reused so the mesh build allocates nothing per vertex. */
const setting = { offset: 0, carving: 1, metal: 0 }

/** How a gem's seat and rim move the surface, how much carving survives there, and how much is metal. */
function settingAt(spec: WandSpec, theta: number, z: number, r0: number): void {
  setting.offset = 0
  setting.carving = 1
  setting.metal = 0
  for (const gem of spec.gems) {
    const outer = gem.radius + RIM_WIDTH
    const dz = z - gem.z
    if (Math.abs(dz) >= outer + SETTING_FADE) continue
    const d = Math.hypot(r0 * angleBetween(theta, gem.theta), dz)
    setting.carving = Math.min(setting.carving, smoothstep(outer, outer + SETTING_FADE, d))
    if (d < gem.radius) {
      setting.offset = -0.3 * gem.radius * Math.sqrt(1 - (d / gem.radius) ** 2)
      if (spec.metalSettings) setting.metal = 1
    } else if (d < outer) {
      setting.offset = RIM_HEIGHT * Math.sin((Math.PI * (d - gem.radius)) / RIM_WIDTH)
      if (spec.metalSettings) setting.metal = 1
    }
  }
}

function strengthAt(g: GrooveSet, z: number): number {
  if (z <= g.from || z >= g.to) return 0
  return smoothstep(g.from, g.from + g.fadeIn, z) * (1 - smoothstep(g.to - g.fadeOut, g.to, z))
}

/** A stencil eases in and out over this much at each end of its band, mm. */
const STENCIL_FADE = 1.2

/** The stencil band at z and how strongly it cuts there; reused so the mesh build allocates nothing per ring. */
interface StencilRing {
  band: StencilBand | null
  strength: number
}

function stencilRingAt(spec: WandSpec, z: number, out: StencilRing): StencilRing {
  out.band = null
  out.strength = 0
  for (const band of spec.stencil?.bands ?? []) {
    if (z <= band.from || z >= band.to) continue
    out.band = band
    out.strength =
      smoothstep(band.from, band.from + STENCIL_FADE, z) *
      (1 - smoothstep(band.to - STENCIL_FADE, band.to, z))
  }
  return out
}

/** How far a branch's lumps and knots have grown in at z, 0 to 1. */
const growthAt = (b: BranchSpec, z: number) => smoothstep(b.from, b.from + 15, z)

/** Carving, lumps and knots stop at a band, as at a ring clamped over the wood. */
const isBanded = (spec: WandSpec, z: number) =>
  spec.zones.some((zone) => zone.uncarved && z >= zone.from && z <= zone.to)

/** How much the lumps move the radius at (angle, z), as a fraction of it, fully grown. */
function lumpAt(b: BranchSpec, theta: number, z: number): number {
  let n = 0
  for (const l of b.lumps) n += l.amp * Math.sin(l.m * theta + l.k * z + l.phase)
  return b.gnarl * n
}

/** The uncarved surface's radius at (angle, z): the profile, plus a branch's lumps. */
function naturalRadius(spec: WandSpec, theta: number, z: number, r0: number): number {
  const b = spec.branch
  return b ? r0 * (1 + lumpAt(b, theta, z) * growthAt(b, z)) : r0
}

interface Surface {
  r: number
  natural: number
  metal: number
  knot: number
}

/**
 * The surface at (angle, z), given what is the same all round the ring at z and
 * the lumps there (grown in), written into `out`.
 */
function surfaceAt(
  spec: WandSpec,
  theta: number,
  z: number,
  r0: number,
  banded: boolean,
  growth: number,
  lump: number,
  stencil: StencilRing,
  out: Surface,
): void {
  settingAt(spec, theta, z, r0)
  const b = spec.branch
  let natural = r0 * (1 + lump)
  let knot = 0
  if (b) {
    const room = banded ? 0 : setting.carving * growth
    if (room > 0) {
      let h = 0
      let pool = 0
      for (const k of b.knots) {
        if (Math.abs(z - k.z) > k.width * 3) continue
        const d = Math.hypot(r0 * angleBetween(theta, k.theta), z - k.z) / k.width
        if (d > 3) continue
        // A raised boss with a dimple where the twig was; stain pools in its heart and round its rim.
        h += k.height * r0 * (Math.exp(-d * d) - 0.55 * Math.exp(-((d / 0.38) ** 2)))
        pool = Math.max(pool, Math.exp(-(((d - 0.9) / 0.35) ** 2)), Math.exp(-((d / 0.3) ** 2)))
      }
      natural += h * room
      knot = pool * room
    }
  }
  let ridgeMetal = 0
  // The deepest cut and the tallest ridge, so overlapping sets combine in any order.
  let cut = r0
  let raised = r0
  if (!banded) {
    for (const g of spec.grooves) {
      const f = strengthAt(g, z) * setting.carving
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
    const { band } = stencil
    if (band && spec.stencil) {
      // Stencils stay off metal ridges and gem settings, as carving does.
      const f = stencil.strength * setting.carving * (1 - ridgeMetal)
      if (f > 0) {
        // The middle of a tile faces up in the box, so a vine or a column of runes shows whole.
        const h = stencilHeight(
          spec.stencil.tile,
          ((theta - SHOWN_SIDE) / TAU) * band.around + 0.5,
          (z - band.from) / band.length,
        )
        cut = Math.min(cut, r0 * (1 - spec.stencil.depth * f * (1 - h)))
      }
    }
  }
  out.r = cut + raised - r0 + setting.offset + natural - r0
  out.natural = natural
  out.metal = Math.max(ridgeMetal, setting.metal)
  out.knot = knot
}

/**
 * Final radius; the profile radius; the natural surface before carving (the
 * profile plus lumps and knots); how much is a metal ridge or gem setting; and
 * how much stain a knot pools, at (angle, z).
 */
export function radiusAt(
  spec: WandSpec,
  theta: number,
  z: number,
): { r: number; r0: number; natural: number; metal: number; knot: number } {
  const r0 = spec.profile(z)
  if (r0 <= 0) return { r: 0, r0: 0, natural: 0, metal: 0, knot: 0 }
  const out: Surface = { r: 0, natural: 0, metal: 0, knot: 0 }
  const b = spec.branch
  const growth = b ? growthAt(b, z) : 0
  const lump = b ? lumpAt(b, theta, z) * growth : 0
  const stencil = stencilRingAt(spec, z, { band: null, strength: 0 })
  surfaceAt(spec, theta, z, r0, isBanded(spec, z), growth, lump, stencil, out)
  return { r: out.r, r0, natural: out.natural, metal: out.metal, knot: out.knot }
}

type Vec3 = [number, number, number]

/** The spine's sideways offset at z, mm: a bow and a few wiggles, less the chord so both ends stay on the axis. */
function spineOffset(b: BranchSpec, L: number, z: number): [number, number] {
  const raw = (zz: number): [number, number] => {
    const u = zz / L
    // Smooth everywhere, so the curvature stays bounded and the inside of the bend never folds.
    const bow = b.bowMm * (Math.sin(Math.PI * u) - 0.2 * Math.sin(TAU * u))
    let x = bow * Math.cos(b.bowDir)
    let y = bow * Math.sin(b.bowDir)
    // Wiggles grow in from the butt of a grown handle, or past the ring of a turned one.
    const grow = smoothstep(b.from / L, b.from / L + 0.4, u)
    for (const w of b.wiggles) {
      const s = w.amp * grow * Math.sin(TAU * w.freq * u + w.phase)
      x += s * Math.cos(w.dir)
      y += s * Math.sin(w.dir)
    }
    return [x, y]
  }
  const [x0, y0] = raw(0)
  const [x1, y1] = raw(L)
  const [x, y] = raw(z)
  const t = z / L
  return [x - (x0 + (x1 - x0) * t), y - (y0 + (y1 - y0) * t)]
}

export interface SpineFrame {
  point: Vec3
  tangent: Vec3
  /** The straight wand's x and y axes, carried onto the spine at this z. */
  normal: Vec3
  binormal: Vec3
}

const STRAIGHT: Omit<SpineFrame, 'point'> = {
  tangent: [0, 0, 1],
  normal: [1, 0, 0],
  binormal: [0, 1, 0],
}

const unit = ([x, y, z]: Vec3): Vec3 => {
  const len = Math.hypot(x, y, z)
  return [x / len, y / len, z / len]
}

/** Where the straight wand's axis point at z ends up, and which way the bent wand runs there. */
export function spineFrame(spec: WandSpec, z: number): SpineFrame {
  const b = spec.branch
  if (!b) return { point: [0, 0, z], ...STRAIGHT }
  const L = spec.lengthMm
  const h = 0.25
  const [x, y] = spineOffset(b, L, z)
  const [xa, ya] = spineOffset(b, L, z - h)
  const [xb, yb] = spineOffset(b, L, z + h)
  const tangent = unit([(xb - xa) / (2 * h), (yb - ya) / (2 * h), 1])
  // Gram-Schmidt from world x: fine while the spine never turns near x, which these gentle bends don't.
  const [tx, ty, tz] = tangent
  const normal = unit([1 - tx * tx, -tx * ty, -tx * tz])
  const [nx, ny, nz] = normal
  const binormal: Vec3 = [ty * nz - tz * ny, tz * nx - tx * nz, tx * ny - ty * nx]
  return { point: [x, y, z], tangent, normal, binormal }
}

/** Carries a point in a straight ring's plane onto the bent wand. */
function bendPoint(f: SpineFrame, x: number, y: number): Vec3 {
  const { point: p, normal: n, binormal: b } = f
  return [p[0] + x * n[0] + y * b[0], p[1] + x * n[1] + y * b[1], p[2] + x * n[2] + y * b[2]]
}

/** Carries a direction on the straight wand onto the bent one. */
function bendDirection(f: SpineFrame, [x, y, z]: Vec3): Vec3 {
  const { normal: n, binormal: b, tangent: t } = f
  return [
    x * n[0] + y * b[0] + z * t[0],
    x * n[1] + y * b[1] + z * t[1],
    x * n[2] + y * b[2] + z * t[2],
  ]
}

/** The surface stays within this much of the profile radius (the generator tests' envelope). */
const ENVELOPE = 1.25

/** How far the bent wand's surface gets from the straight line between its ends, mm. */
export function reachMm(spec: WandSpec): number {
  let reach = 0
  for (let z = 0; z <= spec.lengthMm; z += 1) {
    const [x, y] = spec.branch ? spineOffset(spec.branch, spec.lengthMm, z) : [0, 0]
    reach = Math.max(reach, Math.hypot(x, y) + ENVELOPE * spec.profile(z))
  }
  return reach
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

/** Stencil bands get rings this much closer together, so the pattern's edges don't step. */
const STENCIL_RING_SCALE = 0.5

/** Where the rings go along z: evenly by `step`, and finer over stencil bands. */
function ringPositions(spec: WandSpec, step: number): number[] {
  const { bodyFrom, bodyTo } = spec
  const fine = (spec.stencil?.bands ?? [])
    .map((b): [number, number] => [Math.max(bodyFrom, b.from), Math.min(bodyTo, b.to)])
    .filter(([from, to]) => to > from)
  const pieces: [number, number, number][] = []
  let z = bodyFrom
  for (const [from, to] of fine) {
    if (from > z) pieces.push([z, from, step])
    pieces.push([Math.max(z, from), to, step * STENCIL_RING_SCALE])
    z = Math.max(z, to)
  }
  if (bodyTo > z) pieces.push([z, bodyTo, step])
  const zs = [bodyFrom]
  for (const [from, to, s] of pieces) {
    const n = Math.max(1, Math.ceil((to - from) / s))
    for (let k = 1; k <= n; k++) zs.push(from + ((to - from) * k) / n)
  }
  return zs
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
  const zs = ringPositions(spec, step)
  const rings = zs.length - 1
  const cols = segments + 1 // duplicate seam column for UVs
  const count = (rings + 1) * cols

  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)
  const stainAmount = new Float32Array(count)
  const shade = new Float32Array(count)
  const zone = new Float32Array(count * 3)
  const ridge = new Float32Array(count)
  const knots = new Float32Array(count)
  const depthNorm = new Float32Array(count)

  // Grain runs along the wand. Around it, the texture is mirrored so there's
  // no seam: across goes 0 -> 1 -> 0 over one turn.
  const across = (Math.PI * spec.handleMaxR * 0.8) / textureMm

  const cos = new Float64Array(cols)
  const sin = new Float64Array(cols)
  for (let i = 0; i <= segments; i++) {
    cos[i] = Math.cos((TAU * i) / segments)
    sin[i] = Math.sin((TAU * i) / segments)
  }
  const surface: Surface = { r: 0, natural: 0, metal: 0, knot: 0 }

  // Lumps without a sine per vertex: sin(m*theta + c) = sin(m*theta)cos(c) + cos(m*theta)sin(c).
  const lumps = spec.branch && spec.branch.gnarl > 0 ? spec.branch.lumps : []
  const lumpSin = new Float64Array(lumps.length * cols)
  const lumpCos = new Float64Array(lumps.length * cols)
  lumps.forEach((l, li) => {
    for (let i = 0; i <= segments; i++) {
      lumpSin[li * cols + i] = Math.sin((l.m * TAU * i) / segments)
      lumpCos[li * cols + i] = Math.cos((l.m * TAU * i) / segments)
    }
  })
  const lumpA = new Float64Array(lumps.length)
  const lumpB = new Float64Array(lumps.length)
  const stencil: StencilRing = { band: null, strength: 0 }

  for (let j = 0; j <= rings; j++) {
    const z = zs[j]!
    const r0 = spec.profile(z)
    const banded = isBanded(spec, z)
    stencilRingAt(spec, z, stencil)
    const growth = spec.branch ? growthAt(spec.branch, z) : 0
    const lumpScale = spec.branch ? spec.branch.gnarl * growth : 0
    lumps.forEach((l, li) => {
      lumpA[li] = lumpScale * l.amp * Math.cos(l.k * z + l.phase)
      lumpB[li] = lumpScale * l.amp * Math.sin(l.k * z + l.phase)
    })
    // Bent after building: each straight ring is carried onto the spine before the normal pass.
    const { point, normal, binormal } = spineFrame(spec, z)
    const [px, py, pz] = point
    const [nx, ny, nz] = normal
    const [bx, by, bz] = binormal
    for (let i = 0; i <= segments; i++) {
      const k = j * cols + i
      let lump = 0
      for (let li = 0; li < lumps.length; li++)
        lump += lumpSin[li * cols + i]! * lumpA[li]! + lumpCos[li * cols + i]! * lumpB[li]!
      if (r0 > 0)
        surfaceAt(spec, (TAU * i) / segments, z, r0, banded, growth, lump, stencil, surface)
      const r = r0 > 0 ? surface.r : 0
      const natural = r0 > 0 ? surface.natural : 0
      ridge[k] = r0 > 0 ? surface.metal : 0
      knots[k] = r0 > 0 ? surface.knot : 0
      const x = r * cos[i]!
      const y = r * sin[i]!
      positions[k * 3] = px + x * nx + y * bx
      positions[k * 3 + 1] = py + x * ny + y * by
      positions[k * 3 + 2] = pz + x * nz + y * bz
      const tri = i <= segments / 2 ? (2 * i) / segments : 2 - (2 * i) / segments
      uvs[k * 2] = across * tri
      uvs[k * 2 + 1] = z / textureMm
      depthNorm[k] = natural > 0 ? Math.max(0, (natural - r) / natural) : 0
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
        const out = j === 0 ? -1 : 1
        const [ex, ey, ez] = spineFrame(spec, j === 0 ? bodyFrom : bodyTo).tangent
        nx = ex * out
        ny = ey * out
        nz = ez * out
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
    const s = zs[j]! / L
    const amount = stain.colour
      ? stain.strength *
        (1 - smoothstep(stain.reach - stain.softness / 2, stain.reach + stain.softness / 2, s))
      : 0
    for (let i = 0; i <= segments; i++) {
      const k = j * cols + i
      const groove = Math.min(1, depthNorm[k]! / 0.12)
      const knot = knots[k]!
      const soaks = 1 - zone[k * 3]! - zone[k * 3 + 1]!
      // Stain pools in a knot's heart and round its rim, as in a groove.
      const pooled = 0.6 * stain.strength * groove + 0.7 * stain.strength * knot
      stainAmount[k] = stain.colour ? soaks * Math.min(1, amount + pooled) : 0
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

/** Each set gem's place on the uncarved surface, from the profile and its slope, carried onto the spine. */
export function gemPoses(spec: WandSpec): GemPose[] {
  return spec.gems.map((gem) => {
    const r = naturalRadius(spec, gem.theta, gem.z, spec.profile(gem.z))
    const slope = (spec.profile(gem.z + 0.25) - spec.profile(gem.z - 0.25)) / 0.5
    const [c, s] = [Math.cos(gem.theta), Math.sin(gem.theta)]
    const len = Math.hypot(1, slope)
    const frame = spineFrame(spec, gem.z)
    return {
      position: bendPoint(frame, r * c, r * s),
      normal: bendDirection(frame, [c / len, s / len, -slope / len]),
      radius: gem.radius * 0.92,
    }
  })
}

export interface EndPose {
  position: Vec3
  /** The way the wand runs there, pommel to tip. */
  direction: Vec3
}

/** Where the crystal's base and the orb's centre sit on the spine. */
export function endPoses(spec: WandSpec): { crystal: EndPose | null; orb: EndPose | null } {
  const at = (z: number): EndPose => {
    const f = spineFrame(spec, z)
    return { position: f.point, direction: f.tangent }
  }
  return {
    crystal: spec.crystal ? at(spec.crystal.from) : null,
    orb: spec.orb ? at(spec.orb.centre) : null,
  }
}

/** The very tip, where the spell leaves: the end of the spine, or the point of a crystal standing on its tangent. */
export function tipPose(spec: WandSpec): EndPose {
  const { crystal } = endPoses(spec)
  if (!spec.crystal || !crystal) {
    const f = spineFrame(spec, spec.lengthMm)
    return { position: f.point, direction: f.tangent }
  }
  const length = spec.lengthMm - spec.crystal.from
  const { position: p, direction: d } = crystal
  return {
    position: [p[0] + d[0] * length, p[1] + d[1] * length, p[2] + d[2] * length],
    direction: d,
  }
}
