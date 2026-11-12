import type { GemCut } from '../wand/gems.ts'
import { centreLineAt } from './bend.ts'
import { bladePart } from './blade.ts'
import type { SwordSpec } from './compile.ts'
import { sample } from './curve.ts'
import { bandsPart, collarPart, gemSettingsPart, gripPart, guardPart, pommelPart } from './hilt.ts'
import {
  bezelRim,
  chordRotation,
  COLLAR_GROW,
  gripCore,
  hiltLayout,
  reliefFade,
  type Shape,
  silhouettes,
  wrapRelief,
} from './outline.ts'
import { merge, type MeshPart, type Vec3 } from './sweep.ts'

// The whole sword, one part per material, in its final frame: a curved sword is built with
// a straight hilt, then turned rigidly in the blade plane so its pommel end and tip lie on
// the z axis. Positions and normals turn together; no normal is recomputed.

export interface SwordMesh {
  /** Steel: the blade, with its exact normals and aAlong, aEdge, aFuller, aShade. */
  blade: MeshPart
  /** The fittings metal: guard, collar, pommel, grip bands and gem settings, with aShade. */
  fittings: MeshPart
  /** The wrap's material, with aWrap (1 on the wrap, 0 on what shows under it) and aShade. */
  grip: MeshPart
}

/** Turns a part about the y axis by [cos, sin]: x' = x cos - z sin, z' = x sin + z cos. */
export function turnPart(part: MeshPart, [c, s]: [number, number]): void {
  if (s === 0) return
  for (const arr of [part.positions, part.normals])
    for (let k = 0; k < arr.length; k += 3) {
      const x = arr[k]!
      const z = arr[k + 2]!
      arr[k] = x * c - z * s
      arr[k + 2] = x * s + z * c
    }
}

const turn = ([x, y, z]: Vec3, [c, s]: [number, number]): Vec3 => [x * c - z * s, y, x * s + z * c]

export function buildSwordMesh(spec: SwordSpec): SwordMesh {
  const blade = bladePart(spec)
  const fittings = merge(
    [guardPart(spec), collarPart(spec), pommelPart(spec), bandsPart(spec), gemSettingsPart(spec)].filter(
      (p): p is MeshPart => p !== null,
    ),
  )
  const grip = gripPart(spec)
  const rotation = chordRotation(spec)
  for (const part of [blade, fittings, grip]) turnPart(part, rotation)
  return { blade, fittings, grip }
}

export interface SwordGemPose {
  at: 'pommel' | 'guard'
  /** The middle of the stone's girdle, mm. */
  position: Vec3
  /** Out of the setting. */
  normal: Vec3
  /** The way a long stone lies. */
  along: Vec3
  cut: GemCut
  /** The stone's size, mm, a little inside its seat. */
  radius: number
}

/** Each gem's place in its setting on the pommel or the guard, in the sword's final frame. */
export function swordGemPoses(spec: SwordSpec): SwordGemPose[] {
  const rotation = chordRotation(spec)
  return hiltLayout(spec).gems.map((site) => ({
    at: site.at,
    position: turn(site.position, rotation),
    normal: turn(site.normal, rotation),
    along: turn(site.along, rotation),
    cut: spec.gems.find((g) => g.at === site.at)!.cut,
    radius: site.seat * 0.92,
  }))
}

/** The point of the blade and the way it points, in the sword's final frame. */
export function tipPose(spec: SwordSpec): { position: Vec3; direction: Vec3 } {
  const line = centreLineAt(spec, spec.blade.to)
  const rotation = chordRotation(spec)
  return {
    position: turn([line.x, 0, line.z], rotation),
    direction: turn([-Math.sin(line.angle), 0, Math.cos(line.angle)], rotation),
  }
}

const shapeHalfThickness = (shape: Shape): number => {
  if (shape.kind === 'tube') return Math.max(...shape.samples.map((s) => s.hv))
  if (shape.kind === 'lathe') {
    const scale = shape.facets > 0 ? 1 / Math.cos(Math.PI / shape.facets) : shape.oval
    return Math.max(...shape.profile.map(([r]) => r)) * scale
  }
  if (shape.normal === 'y') return Math.max(...shape.profile.map(([, t]) => Math.abs(t)))
  return Math.max(...shape.outline.map(([, y]) => Math.abs(y))) + Math.abs(shape.centre[1])
}

/** Half-extents across (x) and through (y) that hold every vertex and stone of the sword, mm. */
export function reach(spec: SwordSpec): [number, number] {
  const rotation = chordRotation(spec)
  let x = 0
  for (const poly of silhouettes(spec))
    for (const [px, pz] of poly) x = Math.max(x, Math.abs(turn([px, 0, pz], rotation)[0]))
  const layout = hiltLayout(spec)
  let y = sample(spec.blade.thickness, 0) / 2
  for (const shape of [...layout.guard, ...layout.pommel, ...layout.bands])
    y = Math.max(y, shapeHalfThickness(shape))
  const { grip } = spec
  const relief = wrapRelief(spec)
  for (let i = 0; i <= 40; i++) {
    const z = grip.from + ((grip.to - grip.from) * i) / 40
    y = Math.max(y, gripCore(spec, z)[1] + relief * reliefFade(spec, z))
  }
  if (spec.collar) y = Math.max(y, sample(spec.blade.thickness, 0) / 2 + COLLAR_GROW[0])
  if (spec.guard.langets > 0) y = Math.max(y, sample(spec.blade.thickness, 0) / 2 + 1.5)
  for (const site of layout.gems) {
    const rise = Math.max(0.16 * site.seat + 0.2, 0.42 * 0.92 * site.seat)
    const outer = site.seat * 1.45 + bezelRim(site.seat)
    y = Math.max(y, Math.abs(site.position[1]) + Math.abs(site.normal[1]) * rise + (1 - Math.abs(site.normal[1])) * outer)
  }
  const MARGIN = 0.5
  return [x + MARGIN, y + MARGIN]
}
