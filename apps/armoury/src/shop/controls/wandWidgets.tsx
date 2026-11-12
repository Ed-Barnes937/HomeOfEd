import type { CSSProperties, ReactNode } from 'react'

import type { ChoiceParam, NumberParam, ParamDef, Params } from '../../engine/schema.ts'
import { cmToInches, coreLore, woodLore } from '../../wand/describe.ts'
import { swatchFor } from '../../wand/wandSchema.ts'
import type { WidgetProps } from '../shopView.ts'
import { percent, Stepper, SwatchPicker, type OnChange } from './Widgets.tsx'
import styles from './Widgets.module.scss'

const GRAIN: Record<string, [string, string]> = {
  cherry: ['#a35a3a', '#8a4529'],
  walnut: ['#5e4030', '#47301f'],
  oak: ['#c1935c', '#a57a48'],
  maple: ['#e2c897', '#cdb07c'],
}

function WoodPicker({
  def,
  params,
  onChange,
}: {
  def: ChoiceParam
  params: Params
  onChange: OnChange
}) {
  return (
    <div className={styles.field}>
      <div className={styles.woods} role="radiogroup" aria-label={def.label}>
        {def.options.map((o) => {
          const [a, b] = GRAIN[o.value] ?? ['#888', '#777']
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={params[def.key] === o.value}
              className={styles.wood}
              onClick={() => onChange(def.key, o.value)}
            >
              <span
                className={styles.endGrain}
                style={{
                  background: `repeating-radial-gradient(circle at 44% 47%, ${a} 0 2px, ${b} 2px 5px)`,
                }}
              />
              {o.label}
            </button>
          )
        })}
      </div>
      <p className={styles.lore}>{woodLore(params[def.key] as string)}</p>
    </div>
  )
}

function Ruler({ def, value, onChange }: { def: NumberParam; value: number; onChange: OnChange }) {
  const inches = cmToInches(value)
  const firstInch = Math.ceil(cmToInches(def.min))
  const lastInch = Math.floor(cmToInches(def.max))
  const marks = Array.from({ length: lastInch - firstInch + 1 }, (_, i) => firstInch + i)
  const at = (inch: number) => `${((inch * 2.54 - def.min) / (def.max - def.min)) * 100}%`
  return (
    <div className={styles.ruler}>
      <div className={styles.rulerFace} aria-hidden="true">
        <div className={styles.scale}>
          {Array.from({ length: (lastInch - firstInch) * 4 + 1 }, (_, i) => {
            const inch = firstInch + i / 4
            const kind =
              i % 4 === 0 ? styles.tickWhole : i % 2 === 0 ? styles.tickHalf : styles.tickQuarter
            return <span key={i} className={`${styles.tick} ${kind}`} style={{ left: at(inch) }} />
          })}
          {marks.map((inch) => (
            <span key={inch} className={styles.mark} style={{ left: at(inch) }}>
              {inch}
            </span>
          ))}
          <span className={styles.pointer} style={{ left: `${percent(def, value)}%` }}>
            <span className={styles.reading}>{(Math.round(inches * 4) / 4).toString()} in</span>
          </span>
        </div>
      </div>
      <input
        className={styles.rulerInput}
        type="range"
        aria-label="Length"
        aria-valuetext={`${value} centimetres`}
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange(def.key, Number(e.target.value))}
      />
    </div>
  )
}

function HandlePicker({
  def,
  params,
  onChange,
}: {
  def: ChoiceParam
  params: Params
  onChange: OnChange
}) {
  return (
    <div className={styles.handles} role="radiogroup" aria-label={def.label}>
      {def.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={params[def.key] === o.value}
          className={styles.handle}
          onClick={() => onChange(def.key, o.value)}
        >
          <span className={styles.handleThumb}>
            <img src={`/thumbs/handle-${o.value}.webp`} alt="" draggable={false} />
          </span>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

function CorePicker({
  def,
  params,
  onChange,
}: {
  def: ChoiceParam
  params: Params
  onChange: OnChange
}) {
  return (
    <div className={styles.field}>
      <div className={styles.cores} role="radiogroup" aria-label={def.label}>
        {def.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={params[def.key] === o.value}
            className={styles.core}
            style={
              { '--orb': o.swatch, '--orb-rgb': hexToRgb(o.swatch ?? '#ffffff') } as CSSProperties
            }
            onClick={() => onChange(def.key, o.value)}
          >
            <span className={styles.orb} />
            {o.label}
          </button>
        ))}
      </div>
      <p className={styles.lore}>{coreLore(params[def.key] as string)}</p>
    </div>
  )
}

/** The wand's own controls, by param key; the rest are plain sliders and pills. */
export function wandWidget(
  def: ParamDef,
  { params, onChange }: WidgetProps,
): ReactNode | undefined {
  if (def.kind === 'number') {
    const value = params[def.key] as number
    if (def.key === 'lengthCm') return <Ruler def={def} value={value} onChange={onChange} />
    if (def.key === 'branchSeed')
      return <Stepper def={def} value={value} onChange={onChange} noun="branch" />
    return undefined
  }
  switch (def.key) {
    case 'wood':
      return <WoodPicker def={def} params={params} onChange={onChange} />
    case 'stainColour':
    case 'paintColour':
    case 'metal':
      return (
        <SwatchPicker
          def={def}
          params={params}
          onChange={onChange}
          unswatched={GRAIN[params.wood as string]?.[0] ?? '#c1935c'}
        />
      )
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
      return undefined
  }
}
