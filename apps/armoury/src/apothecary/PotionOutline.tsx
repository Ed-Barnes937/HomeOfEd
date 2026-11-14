import { memo, useMemo } from 'react'

import type { Params } from '../engine/schema.ts'
import { compilePotion, type PotionSpec } from '../potion/compile.ts'
import { potionOutline, type PotionSilhouette } from '../potion/outline.ts'
import { GLASS_TINTS } from '../potion/potionSchema.ts'

type Point = [number, number]

const CORK = '#a7814f'

function stopperColour(spec: PotionSpec): string {
  return spec.stopper === 'glass' ? GLASS_TINTS[spec.glass] : CORK
}

/** The bands' risen sides run on into one column, mirrored back down: a single fill to the full level. */
function mixedLiquid(bands: PotionSilhouette['bands'], colour: string): PotionSilhouette['bands'] {
  const risen = bands.flatMap((band) => band.points.slice(0, band.points.length / 2))
  const mirrored = [...risen].reverse().map(([x, y]): Point => [-x, y])
  return [{ colour, points: [...risen, ...mirrored] }]
}

/** The bottle drawn flat from the side: the glass in a faint line, the pours in their colours, the stopper. */
export const PotionOutline = memo(function PotionOutline({
  params,
  className,
}: {
  params: Params
  className?: string
}) {
  const { spec, silhouette } = useMemo(() => {
    const spec = compilePotion(params)
    return { spec, silhouette: potionOutline(spec) }
  }, [params])
  const { widthMm, heightMm } = silhouette
  const pathOf = (points: Point[]) =>
    `M${points.map(([x, y]) => `${x.toFixed(1)} ${(heightMm - y).toFixed(1)}`).join('L')}Z`
  const pad = 2
  const viewBox = [-widthMm / 2 - pad, -pad, widthMm + pad * 2, heightMm + pad * 2].join(' ')
  const liquid = spec.mix && spec.mixed ? mixedLiquid(silhouette.bands, spec.mix.colour) : null
  return (
    <svg
      className={className}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      {(liquid ?? silhouette.bands).map((band, i) => (
        <path key={i} d={pathOf(band.points)} fill={band.colour} />
      ))}
      <path
        d={pathOf(silhouette.glass)}
        fill="rgba(220, 236, 242, 0.08)"
        stroke="rgba(230, 240, 245, 0.55)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d={pathOf(silhouette.stopper)} fill={stopperColour(spec)} />
    </svg>
  )
})
