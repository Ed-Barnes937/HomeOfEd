import { memo } from 'react'

import type { Params } from '../engine/schema.ts'
import type { Crop } from './outline.ts'
import { drawOutline, type Drawing } from './thumbnails.ts'

/** Where the drawing sits in a box of another shape, as SVG's preserveAspectRatio. */
type Align = 'xMidYMid' | 'xMaxYMid'

/** An outline already drawn; it re-renders only when handed another drawing. */
export const OutlineSvg = memo(function OutlineSvg({
  drawing,
  align = 'xMidYMid',
  className,
}: {
  drawing: Drawing
  align?: Align
  className?: string
}) {
  return (
    <svg
      className={className}
      viewBox={drawing.viewBox}
      preserveAspectRatio={align}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={drawing.d} />
    </svg>
  )
})

/** The sword drawn flat from above as one SVG shape, cropped to the whole sword or a part. */
export function SwordOutline({
  params,
  crop = 'sword',
  align,
  className,
}: {
  params: Params
  crop?: Crop
  align?: Align
  className?: string
}) {
  return <OutlineSvg drawing={drawOutline(params, crop)} align={align} className={className} />
}
