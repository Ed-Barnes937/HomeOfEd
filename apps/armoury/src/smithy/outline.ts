import { sample } from '../sword/curve.ts'
import type { SwordSpec } from '../sword/compile.ts'

// A stand-in for `swordOutline` (sword/outline.ts, ticket 06) with the same signature: the
// sword seen from above as closed polylines of [z, y] in mm, pommel end at z = 0.

type Polyline = [number, number][]

const STEPS = 32

function band(
  from: number,
  to: number,
  above: (u: number) => number,
  below: (u: number) => number,
  shift: (u: number) => number = () => 0,
): Polyline {
  const us = Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS)
  const z = (u: number) => from + (to - from) * u
  return [
    ...us.map((u): [number, number] => [z(u), shift(u) + above(u)]),
    ...[...us].reverse().map((u): [number, number] => [z(u), shift(u) - below(u)]),
  ]
}

function ellipse(cz: number, cy: number, rz: number, ry: number): Polyline {
  return Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2
    return [cz + rz * Math.cos(a), cy + ry * Math.sin(a)]
  })
}

function guardOutline(spec: SwordSpec): Polyline[] {
  const { from, to, span, sweep, thickness } = spec.guard
  const h = span / 2
  const w = h * 0.2
  if (sweep < 0) {
    const bow: Polyline = [
      [from + sweep, -h],
      [to, -h],
      [to, -h + thickness],
      [from + sweep, -h + thickness],
    ]
    return [rect(from, to, h), bow]
  }
  return [
    [
      [from + sweep, -h],
      [to + sweep, -h],
      [to, -w],
      [to, w],
      [to + sweep, h],
      [from + sweep, h],
      [from, w],
      [from, -w],
    ],
  ]
}

const rect = (from: number, to: number, h: number): Polyline => [
  [from, -h],
  [to, -h],
  [to, h],
  [from, h],
]

export function outlineOf(spec: SwordSpec): Polyline[] {
  const { blade, grip, pommel, collar } = spec
  const gripRadius = Math.max(...grip.radius.map(([, r]) => r))
  const bend = blade.curve ? 4 * blade.curve.depthMm : 0
  return [
    ellipse((pommel.from + pommel.to) / 2, 0, (pommel.to - pommel.from) / 2, pommel.radius),
    band(
      grip.from,
      grip.to,
      (u) => sample(grip.radius, u),
      (u) => sample(grip.radius, u),
    ),
    ...(collar ? [rect(collar.from, collar.to, gripRadius * 1.15)] : []),
    ...guardOutline(spec),
    band(
      blade.from,
      blade.to,
      (u) => sample(blade.backWidth ?? blade.halfWidth, u),
      (u) => sample(blade.halfWidth, u),
      (u) => bend * u * u,
    ),
  ]
}

export type Crop = 'sword' | 'guard' | 'pommel'

/** The SVG viewBox, in the outline's mm, that frames the whole sword, its guard or its pommel. */
export function viewBoxFor(spec: SwordSpec, outline: Polyline[], crop: Crop): string {
  const ys = outline.flat().map(([, y]) => y)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  const box = (z0: number, z1: number, y0: number, y1: number) =>
    [z0, y0, z1 - z0, y1 - y0].map((n) => Math.round(n * 10) / 10).join(' ')
  if (crop === 'guard') {
    const { from, to, span, sweep } = spec.guard
    return box(
      Math.min(from, from + sweep) - 30,
      Math.max(to, to + sweep) + 60,
      -span / 2 - 10,
      span / 2 + 10,
    )
  }
  if (crop === 'pommel') {
    const r = Math.max(spec.pommel.radius, ...spec.grip.radius.map(([, v]) => v)) + 8
    return box(-8, spec.pommel.to + (spec.grip.to - spec.grip.from) * 0.4, -r, r)
  }
  return box(-10, spec.lengthMm + 10, top - 10, bottom + 10)
}

export function pathOf(outline: Polyline[]): string {
  return outline
    .map((line) => `M${line.map(([z, y]) => `${z.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`)
    .join('')
}
