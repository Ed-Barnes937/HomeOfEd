import type { ReactNode } from 'react'

import {
  allowedOptions,
  normalise,
  type ChoiceParam,
  type ParamDef,
  type Params,
} from '../engine/schema.ts'
import { SwatchPicker, type OnChange } from '../shop/controls/Widgets.tsx'
import type { WidgetProps } from '../shop/shopView.ts'
import { swordItem } from '../sword/item.ts'
import { swordSwatchFor } from '../sword/swordSchema.ts'
import type { Crop } from './outline.ts'
import { SwordOutline } from './SwordOutline.tsx'
import styles from './swordWidgets.module.scss'

/** The sword as it would be with this option chosen, as the workbench would make it. */
const withOption = (params: Params, key: string, value: string): Params =>
  normalise(swordItem.schema, {
    ...params,
    [key]: value,
    ...swordItem.follows?.(params, key, value),
  })

function OutlinePicker({
  def,
  params,
  onChange,
  crop,
}: {
  def: ChoiceParam
  params: Params
  onChange: OnChange
  crop: Crop
}) {
  return (
    <div className={styles.field}>
      <div
        className={crop === 'sword' ? styles.kinds : styles.parts}
        role="radiogroup"
        aria-label={def.label}
      >
        {allowedOptions(def, params).map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={params[def.key] === o.value}
            className={styles.option}
            onClick={() => onChange(def.key, o.value)}
          >
            <SwordOutline
              className={styles.thumb}
              params={withOption(params, def.key, o.value)}
              crop={crop}
            />
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const CROPS: Record<string, Crop> = { family: 'sword', guard: 'guard', pommel: 'pommel' }
const SWATCHED = ['fittings', 'gripColour', 'runeColour']

/** The sword's own controls, by param key; the rest are plain sliders and pills. */
export function swordWidget(
  def: ParamDef,
  { params, onChange }: WidgetProps,
): ReactNode | undefined {
  if (def.kind !== 'choice') return undefined
  const crop = CROPS[def.key]
  if (crop) return <OutlinePicker def={def} params={params} onChange={onChange} crop={crop} />
  if (SWATCHED.includes(def.key))
    return <SwatchPicker def={def} params={params} onChange={onChange} unswatched="#9a9da1" />
  if (def.key === 'gemColour') {
    const runes = swordSwatchFor('runeColour', params.runeColour as string) ?? '#8fe3ff'
    return (
      <SwatchPicker
        def={def}
        params={params}
        onChange={onChange}
        unswatched={`radial-gradient(circle, #fff 0, ${runes} 45%)`}
      />
    )
  }
  return undefined
}
