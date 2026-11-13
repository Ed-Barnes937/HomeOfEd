import { memo, useMemo } from 'react'

import type { Params } from '../engine/schema.ts'
import { BOTTLES } from '../potion/bottles.ts'
import { compilePotion, type PotionSpec } from '../potion/compile.ts'
import { GLASS_TINTS, MAX_POURS } from '../potion/potionSchema.ts'

type Point = [number, number]

interface Drawing {
  glass: Point[]
  stopper: Point[]
  stopperColour: string
  bands: { points: Point[]; colour: string }[]
  widthMm: number
  heightMm: number
}

const WALL_MM = 2
const LIP_MM = 3
const FULL_AT = 0.82
const CORK = '#a7814f'

// A stand-in for ticket 06's `potionOutline(spec)`: the radius along the height, straight between
// the bottle row's control points, with pours of equal volume up to FULL_AT of the body.
function drawPotion(spec: PotionSpec): Drawing {
  const row = BOTTLES[spec.shape]
  const body = row.body.map(([f, r]): Point => [f * spec.bodyHeightMm, r])
  const neckTop = spec.bodyHeightMm + spec.neckMm
  const profile: Point[] = [
    ...body,
    [neckTop - LIP_MM, row.neckRadiusMm],
    [neckTop - LIP_MM, row.neckRadiusMm + row.lipMm],
    [neckTop, row.neckRadiusMm + row.lipMm],
  ]
  const radiusAt = (z: number) => {
    const i = profile.findIndex(([pz]) => pz >= z)
    if (i <= 0) return profile[Math.max(i, 0)]![1]
    const [z0, r0] = profile[i - 1]!
    const [z1, r1] = profile[i]!
    return z1 === z0 ? r1 : r0 + ((z - z0) / (z1 - z0)) * (r1 - r0)
  }
  const innerAt = (z: number) => Math.max(radiusAt(z) - WALL_MM, 0.5)

  const fullZ = spec.bodyHeightMm * FULL_AT
  const volumeTo = (top: number) => {
    let v = 0
    for (let z = WALL_MM; z < top; z += 0.5) v += innerAt(z + 0.25) ** 2 * 0.5
    return v
  }
  const perPour = volumeTo(fullZ) / MAX_POURS
  const levels = [WALL_MM]
  let v = 0
  for (let z = WALL_MM; levels.length <= spec.layers.length && z < fullZ + 1; z += 0.5) {
    v += innerAt(z + 0.25) ** 2 * 0.5
    if (v >= perPour * levels.length) levels.push(z + 0.5)
  }

  const up = (z: number) => spec.heightMm - z
  const sides = (points: Point[]): Point[] => [
    ...points.map(([z, r]): Point => [r, up(z)]),
    ...[...points].reverse().map(([z, r]): Point => [-r, up(z)]),
  ]
  const between = (z0: number, z1: number): Point[] => {
    const steps = Math.max(2, Math.ceil(z1 - z0))
    return Array.from({ length: steps + 1 }, (_, i): Point => {
      const z = z0 + ((z1 - z0) * i) / steps
      return [z, innerAt(z)]
    })
  }

  const plugR = row.neckRadiusMm - 1
  const stopperTop = spec.heightMm
  const stopperFoot = neckTop - 8
  return {
    glass: sides(profile),
    stopper: [
      [plugR, up(stopperFoot)],
      [plugR + 1, up(stopperTop)],
      [-plugR - 1, up(stopperTop)],
      [-plugR, up(stopperFoot)],
    ],
    stopperColour:
      spec.stopper === 'glass'
        ? GLASS_TINTS[spec.glass]
        : spec.stopper === 'wax'
          ? (spec.waxColour ?? CORK)
          : CORK,
    bands: spec.layers.map((layer, i) => ({
      points: sides(between(levels[i]!, levels[i + 1] ?? levels[i]!)),
      colour: layer.colour,
    })),
    widthMm: 2 * Math.max(...profile.map(([, r]) => r)),
    heightMm: spec.heightMm,
  }
}

const pathOf = (points: Point[]) =>
  `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`

/** The bottle drawn flat from the side: the glass in a faint line, the pours in their colours, the stopper. */
export const PotionOutline = memo(function PotionOutline({
  params,
  className,
}: {
  params: Params
  className?: string
}) {
  const drawing = useMemo(() => drawPotion(compilePotion(params)), [params])
  const pad = 2
  const viewBox = [
    -drawing.widthMm / 2 - pad,
    -pad,
    drawing.widthMm + pad * 2,
    drawing.heightMm + pad * 2,
  ].join(' ')
  return (
    <svg className={className} viewBox={viewBox} aria-hidden="true">
      {drawing.bands.map((band, i) => (
        <path key={i} d={pathOf(band.points)} fill={band.colour} />
      ))}
      <path
        d={pathOf(drawing.glass)}
        fill="rgba(220, 236, 242, 0.08)"
        stroke="rgba(230, 240, 245, 0.55)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d={pathOf(drawing.stopper)} fill={drawing.stopperColour} />
    </svg>
  )
})
