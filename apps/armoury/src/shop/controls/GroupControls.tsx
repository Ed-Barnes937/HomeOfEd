import { isVisible, type ParamDef, type Params } from '../../engine/schema.ts'
import { swatchFor, wandSchema } from '../../wand/wandSchema.ts'
import styles from './GroupControls.module.scss'
import {
  CorePicker,
  HandlePicker,
  Pills,
  Ruler,
  Slider,
  Stepper,
  SwatchPicker,
  WoodPicker,
  type OnChange,
} from './Widgets.tsx'

function Control({
  def,
  params,
  onChange,
  inline,
}: {
  def: ParamDef
  params: Params
  onChange: OnChange
  inline: boolean
}) {
  if (def.kind === 'number') {
    const value = params[def.key] as number
    if (def.key === 'lengthCm') return <Ruler def={def} value={value} onChange={onChange} />
    if (def.key === 'branchSeed')
      return <Stepper def={def} value={value} onChange={onChange} noun="branch" />
    return <Slider def={def} value={value} onChange={onChange} />
  }
  switch (def.key) {
    case 'wood':
      return <WoodPicker def={def} params={params} onChange={onChange} />
    case 'stainColour':
    case 'paintColour':
    case 'metal':
      return <SwatchPicker def={def} params={params} onChange={onChange} />
    case 'gemColour':
      return (
        <SwatchPicker
          def={def}
          params={params}
          onChange={onChange}
          unswatched={`radial-gradient(circle, #fff 0, ${swatchFor('core', params.core as string)} 45%)`}
        />
      )
    case 'handleStyle':
      return <HandlePicker def={def} params={params} onChange={onChange} />
    case 'core':
      return <CorePicker def={def} params={params} onChange={onChange} />
    default:
      return <Pills def={def} params={params} onChange={onChange} inline={inline} />
  }
}

export function GroupControls({
  group,
  params,
  onChange,
  inline = false,
}: {
  group: string
  params: Params
  onChange: OnChange
  /** Labels beside their pills, for a compact row. */
  inline?: boolean
}) {
  const defs = wandSchema.params.filter((d) => d.group === group && isVisible(d, params))
  return (
    <div className={styles.controls}>
      {defs.map((def) => (
        <Control key={def.key} def={def} params={params} onChange={onChange} inline={inline} />
      ))}
    </div>
  )
}
