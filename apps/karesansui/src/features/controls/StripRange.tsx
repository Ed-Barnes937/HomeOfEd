import { useEffect, useRef, useState } from 'react'

import strip from './Strip.module.scss'
import styles from './StripRange.module.scss'

export interface StripRangeProps {
  /** Uppercase key, e.g. "Offset". */
  label: string
  /** Display text for the current value, e.g. "0.66" or "brisk". */
  valueText: string
  value: number
  min: number
  max: number
  /** Receives the raw slider value (min..max); the page does any clamping. */
  onChange: (value: number) => void
  /** Base test id; the slider is `${testId}-slider`, the readout `${testId}-value`. */
  testId: string
}

/**
 * A continuous strip item: reads `LABEL value`, and clicking it reveals a
 * hairline slider in a small popover beneath — no permanent track cluttering
 * the strip (ADR 0021). A real disclosure: Escape and outside-click close it,
 * and focus moves into the slider on open so it's keyboard-operable.
 */
export function StripRange({ label, valueText, value, min, max, onChange, testId }: StripRangeProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) sliderRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e: PointerEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={strip.item}
        data-testid={testId}
        aria-expanded={open}
        aria-label={`${label}: ${valueText}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={strip.k}>{label}</span>
        <span className={strip.v} data-testid={`${testId}-value`}>
          {valueText}
        </span>
      </button>

      {open && (
        <div className={styles.pop} data-testid={`${testId}-pop`}>
          <input
            ref={sliderRef}
            type="range"
            className={styles.range}
            data-testid={`${testId}-slider`}
            min={min}
            max={max}
            value={value}
            aria-label={label}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        </div>
      )}
    </div>
  )
}
