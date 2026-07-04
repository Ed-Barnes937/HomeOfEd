import type { CursorIcon } from '../sim/settings.ts'
import styles from './CursorIconPicker.module.scss'

export interface CursorIconPickerProps {
  value: CursorIcon
  onChange: (icon: CursorIcon) => void
}

const ICONS: { id: CursorIcon; label: string }[] = [
  { id: 'off', label: 'No cursor icon' },
  { id: 'ring', label: 'Ring cursor icon' },
  { id: 'creatures', label: 'Creature cursor icon' },
]

function Icon({ icon }: { icon: CursorIcon }) {
  if (icon === 'off') {
    return (
      <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M4.6 4.6l7.8 7.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  if (icon === 'creatures') {
    // A little berry — the attract creature stands in for the pair.
    return (
      <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
        <circle cx="8.5" cy="10" r="4.2" fill="currentColor" />
        <path
          d="M8.5 5.8V3.4c1-.2 1.9.5 1.9 1.5-.7.6-1.3.8-1.9.9z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
    </svg>
  )
}

/** Segmented control: off / ring / creatures. Mirrors ShapePicker. */
export function CursorIconPicker({ value, onChange }: CursorIconPickerProps) {
  return (
    <div className={styles.seg}>
      {ICONS.map((i) => (
        <button
          key={i.id}
          type="button"
          className={styles.button}
          aria-pressed={i.id === value}
          aria-label={i.label}
          onClick={() => onChange(i.id)}
        >
          <Icon icon={i.id} />
        </button>
      ))}
    </div>
  )
}
