import type { CSSProperties } from 'react'

import styles from './Slider.module.scss'

export interface SliderProps {
  label: string
  /** Precomputed display text (e.g. `"0.66 r"`, `"brisk"`, `"13 of 40"`). */
  valueText: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  testId: string
}

/** Reused for Pin offset / Speed / Rotations — label + value + a gold-fill range. */
export function Slider({ label, valueText, value, min, max, step = 1, onChange, testId }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  const trackStyle = { '--pct': `${pct}%` } as CSSProperties

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value} data-testid={`${testId}-value`}>
          {valueText}
        </span>
      </div>
      <input
        type="range"
        className={styles.range}
        style={trackStyle}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}
