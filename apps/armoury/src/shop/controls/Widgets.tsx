import type { CSSProperties } from 'react'

import {
  allowedOptions,
  type ChoiceParam,
  type NumberParam,
  type Params,
  type ParamValue,
} from '../../engine/schema.ts'
import { cmToInches, coreLore, woodLore } from '../../wand/describe.ts'
import { swatchFor } from '../../wand/wandSchema.ts'
import styles from './Widgets.module.scss'

export type OnChange = (key: string, value: ParamValue) => void

const percent = (def: NumberParam, value: number) => ((value - def.min) / (def.max - def.min)) * 100

export function Slider({
  def,
  value,
  onChange,
}: {
  def: NumberParam
  value: number
  onChange: OnChange
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{def.label}</span>
      <input
        className={styles.slider}
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        style={{ '--fill': `${percent(def, value)}%` } as CSSProperties}
        onChange={(e) => onChange(def.key, Number(e.target.value))}
      />
      {def.ends && (
        <span className={styles.ends} aria-hidden="true">
          <span>{def.ends[0]}</span>
          <span>{def.ends[1]}</span>
        </span>
      )}
    </label>
  )
}

export function Pills({
  def,
  params,
  onChange,
  inline = false,
}: {
  def: ChoiceParam
  params: Params
  onChange: OnChange
  /** The label beside the pills rather than above them. */
  inline?: boolean
}) {
  return (
    <div className={inline ? styles.inline : styles.field}>
      <span className={styles.label} id={`label-${def.key}`}>
        {def.label}
      </span>
      <div className={styles.pills} role="radiogroup" aria-labelledby={`label-${def.key}`}>
        {allowedOptions(def, params).map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={params[def.key] === o.value}
            className={styles.pill}
            onClick={() => onChange(def.key, o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const GRAIN: Record<string, [string, string]> = {
  cherry: ['#a35a3a', '#8a4529'],
  walnut: ['#5e4030', '#47301f'],
  oak: ['#c1935c', '#a57a48'],
  maple: ['#e2c897', '#cdb07c'],
}

export function WoodPicker({
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

export function SwatchPicker({
  def,
  params,
  onChange,
}: {
  def: ChoiceParam
  params: Params
  onChange: OnChange
}) {
  const natural = GRAIN[params.wood as string]?.[0] ?? '#c1935c'
  // An option with no colour of its own is the wood's natural colour, or for gems the core's.
  const unswatched =
    def.key === 'gemColour'
      ? `radial-gradient(circle, #fff 0, ${swatchFor('core', params.core as string)} 45%)`
      : natural
  return (
    <div className={styles.inline}>
      <span className={styles.label} id={`label-${def.key}`}>
        {def.label}
      </span>
      <div className={styles.swatches} role="radiogroup" aria-labelledby={`label-${def.key}`}>
        {allowedOptions(def, params).map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={params[def.key] === o.value}
            aria-label={o.label}
            title={o.label}
            className={styles.swatch}
            style={{ background: o.swatch ?? unswatched }}
            onClick={() => onChange(def.key, o.value)}
          />
        ))}
      </div>
    </div>
  )
}

export function Ruler({
  def,
  value,
  onChange,
}: {
  def: NumberParam
  value: number
  onChange: OnChange
}) {
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

export function HandlePicker({
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

export function CorePicker({
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
