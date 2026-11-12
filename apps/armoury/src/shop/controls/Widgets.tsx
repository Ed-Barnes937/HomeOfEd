import type { CSSProperties } from 'react'

import {
  allowedOptions,
  type ChoiceParam,
  type NumberParam,
  type Params,
  type ParamValue,
} from '../../engine/schema.ts'
import styles from './Widgets.module.scss'

export type OnChange = (key: string, value: ParamValue) => void

export const percent = (def: NumberParam, value: number) =>
  ((value - def.min) / (def.max - def.min)) * 100

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

/** Steps a whole-number param one at a time, round from the last value to the first. */
export function Stepper({
  def,
  value,
  onChange,
  noun,
}: {
  def: NumberParam
  value: number
  onChange: OnChange
  /** What one step is, for the buttons' names: "branch" gives "Next branch". */
  noun: string
}) {
  const count = def.max - def.min + 1
  const step = (by: number) => onChange(def.key, def.min + ((value - def.min + by + count) % count))
  return (
    <div className={styles.inline} role="group" aria-labelledby={`label-${def.key}`}>
      <span className={styles.label} id={`label-${def.key}`}>
        {def.label}
      </span>
      <div className={styles.stepper}>
        <button
          type="button"
          className={styles.step}
          aria-label={`Previous ${noun}`}
          onClick={() => step(-1)}
        >
          ‹
        </button>
        <span className={styles.stepValue} aria-live="polite">
          {value - def.min + 1}
        </span>
        <button
          type="button"
          className={styles.step}
          aria-label={`Next ${noun}`}
          onClick={() => step(1)}
        >
          ›
        </button>
      </div>
    </div>
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

export function SwatchPicker({
  def,
  params,
  onChange,
  unswatched,
}: {
  def: ChoiceParam
  params: Params
  onChange: OnChange
  /** How an option with no colour of its own looks. */
  unswatched: string
}) {
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
