import type { BoidShape } from '../sim/render/renderer.ts'
import styles from './ShapePicker.module.scss'

export interface ShapePickerProps {
  value: BoidShape
  onChange: (shape: BoidShape) => void
}

const SHAPES: { id: BoidShape; label: string }[] = [
  { id: 'triangle', label: 'Triangle boids' },
  { id: 'dot', label: 'Dot boids' },
  { id: 'line', label: 'Line boids' },
]

function ShapeIcon({ shape }: { shape: BoidShape }) {
  if (shape === 'dot') {
    return (
      <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="3.2" fill="currentColor" />
      </svg>
    )
  }
  if (shape === 'line') {
    return (
      <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
        <path d="M3 8.5h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="13" cy="8.5" r="1.8" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
      <path d="M14 8.5L4.5 13l2.4-4.5L4.5 4z" fill="currentColor" />
    </svg>
  )
}

/** Segmented control: triangle / dot / line. */
export function ShapePicker({ value, onChange }: ShapePickerProps) {
  return (
    <div className={styles.seg}>
      {SHAPES.map((s) => (
        <button
          key={s.id}
          type="button"
          className={styles.button}
          aria-pressed={s.id === value}
          aria-label={s.label}
          onClick={() => onChange(s.id)}
        >
          <ShapeIcon shape={s.id} />
        </button>
      ))}
    </div>
  )
}
