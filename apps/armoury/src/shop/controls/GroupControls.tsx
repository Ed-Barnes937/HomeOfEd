import { isVisible, type ItemSchema, type ParamDef, type Params } from '../../engine/schema.ts'
import type { ShopView } from '../shopView.ts'
import styles from './GroupControls.module.scss'
import { Pills, Slider, type OnChange } from './Widgets.tsx'

function Control({
  def,
  params,
  onChange,
  inline,
  widget,
}: {
  def: ParamDef
  params: Params
  onChange: OnChange
  inline: boolean
  widget: ShopView['widget']
}) {
  const own = widget?.(def, { params, onChange, inline })
  if (own !== undefined) return own
  if (def.kind === 'number') {
    return <Slider def={def} value={params[def.key] as number} onChange={onChange} />
  }
  return <Pills def={def} params={params} onChange={onChange} inline={inline} />
}

export function GroupControls({
  group,
  schema,
  params,
  onChange,
  widget,
  inline = false,
}: {
  group: string
  schema: ItemSchema
  params: Params
  onChange: OnChange
  widget: ShopView['widget']
  /** Labels beside their pills, for a compact row. */
  inline?: boolean
}) {
  const defs = schema.params.filter((d) => d.group === group && isVisible(d, params))
  return (
    <div className={styles.controls}>
      {defs.map((def) => (
        <Control
          key={def.key}
          def={def}
          params={params}
          onChange={onChange}
          inline={inline}
          widget={widget}
        />
      ))}
    </div>
  )
}
