import type { ReactNode } from 'react'

import type { ParamDef } from '../engine/schema.ts'
import { isPourKey, potionSwatchFor } from '../potion/potionSchema.ts'
import { SwatchPicker } from '../shop/controls/Widgets.tsx'
import type { WidgetProps } from '../shop/shopView.ts'
import { PourPicker } from './pourPicker.tsx'

/** The potion's own controls: one picker owns the Pours group and `mixed` has no control; the glass is tinted swatches. */
export function potionWidget(
  def: ParamDef,
  { params, onChange }: WidgetProps,
): ReactNode | undefined {
  if (def.kind !== 'choice') return undefined
  if (def.key === 'pour1') return <PourPicker params={params} onChange={onChange} />
  if (isPourKey(def.key) || def.key === 'mixed') return null
  if (def.key === 'glass') {
    const tinted = {
      ...def,
      options: def.options.map((o) => ({ ...o, swatch: potionSwatchFor('glass', o.value) })),
    }
    return <SwatchPicker def={tinted} params={params} onChange={onChange} unswatched="#d8ecf2" />
  }
  return undefined
}
