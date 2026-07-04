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
  { id: 'rocket', label: 'Rocket boids' },
  { id: 'duck', label: 'Duck boids' },
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
  if (shape === 'rocket') {
    return (
      <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
        <path d="M8.5 1.8c2.3 1.9 3.2 4.7 2.6 8.2H5.9C5.3 6.5 6.2 3.7 8.5 1.8Z" fill="currentColor" />
        <path d="M5.9 10 3.7 12.8l2.6-1.1zM11.1 10l2.2 2.8-2.6-1.1z" fill="currentColor" />
        <path d="M7 13.5h3l-1.5 2z" fill="currentColor" />
      </svg>
    )
  }
  if (shape === 'duck') {
    return (
      <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
        <ellipse cx="7.5" cy="10" rx="5" ry="3.3" fill="currentColor" />
        <circle cx="11.5" cy="6.5" r="2.4" fill="currentColor" />
        <path d="M13.5 5.8 16 6.5l-2.5 1z" fill="currentColor" />
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
