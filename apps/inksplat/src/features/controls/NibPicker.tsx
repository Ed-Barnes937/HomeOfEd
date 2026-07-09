import { NIB_SIZES } from '../doodle/useDoodle.ts'
import styles from './NibPicker.module.scss'

export interface NibPickerProps {
  value: number
  onChange: (width: number) => void
}

// Dot diameter (px) per nib width — spec §11.2 (1.8→~5px, 3.4→~8px, 6→~12px).
const NIBS: { width: number; label: string; dot: number }[] = [
  { width: NIB_SIZES[0], label: 'Thin nib', dot: 5 },
  { width: NIB_SIZES[1], label: 'Medium nib', dot: 8 },
  { width: NIB_SIZES[2], label: 'Thick nib', dot: 12 },
]

/** 3-button nib-width picker: each button shows a dot sized to its nib. */
export function NibPicker({ value, onChange }: NibPickerProps) {
  return (
    <div className={styles.seg} role="group" aria-label="Nib size">
      {NIBS.map((n) => (
        <button
          key={n.width}
          type="button"
          className={styles.button}
          aria-pressed={n.width === value}
          aria-label={n.label}
          onClick={() => onChange(n.width)}
        >
          <span className={styles.dot} style={{ width: n.dot, height: n.dot }} />
        </button>
      ))}
    </div>
  )
}
