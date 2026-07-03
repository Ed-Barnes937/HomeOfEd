import type { CSSProperties } from 'react'

import styles from './Slider.module.scss'

export interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  const trackStyle = { '--pct': `${pct}%` } as CSSProperties

  return (
    <div className={styles.slider}>
      <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value} data-testid={`slider-${label}-value`}>
          {format(value)}
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
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}
