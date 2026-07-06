import type { CSSProperties } from 'react'

import styles from './Slider.module.scss'

export interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  /** Plain-english blurb shown on hover/focus of the heading; omit for no tooltip. */
  tooltip?: string
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step, format, tooltip, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  const trackStyle = { '--pct': `${pct}%` } as CSSProperties

  return (
    <div className={styles.slider}>
      <div className={styles.row}>
        <span
          className={styles.label}
          data-testid={`slider-${label}-label`}
          tabIndex={tooltip ? 0 : undefined}
        >
          {label}
          {tooltip ? (
            <span className={styles.tooltip} role="tooltip" data-testid={`slider-${label}-tooltip`}>
              {tooltip}
            </span>
          ) : null}
        </span>
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
