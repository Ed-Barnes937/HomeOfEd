import type { Params } from '../engine/schema.ts'
import { compileSword } from '../sword/compile.ts'
import { outlineOf, pathOf, viewBoxFor, type Crop } from './outline.ts'

/** The sword drawn flat from above as one SVG shape, cropped to the whole sword or a part. */
export function SwordOutline({
  params,
  crop = 'sword',
  align = 'xMidYMid',
  className,
}: {
  params: Params
  crop?: Crop
  /** Where the drawing sits in a box of another shape, as SVG's preserveAspectRatio. */
  align?: 'xMidYMid' | 'xMaxYMid'
  className?: string
}) {
  const spec = compileSword(params)
  const outline = outlineOf(spec)
  return (
    <svg
      className={className}
      viewBox={viewBoxFor(spec, outline, crop)}
      preserveAspectRatio={align}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={pathOf(outline)} />
    </svg>
  )
}
