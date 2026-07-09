import { ringOpts } from '../garden/engine/gears.ts'
import styles from './RingPicker.module.scss'

export interface RingPickerProps {
  ring: number
  onChange: (ring: number) => void
}

/** The 3 ring-gear chips — a static gold-rimmed dial + the selected outline. */
export function RingPicker({ ring, onChange }: RingPickerProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.label}>Ring gear</span>
        <span className={styles.value}>{ring} teeth</span>
      </div>
      <div className={styles.row}>
        {ringOpts().map((teeth) => {
          const selected = teeth === ring
          return (
            <button
              key={teeth}
              type="button"
              className={styles.chip}
              data-testid={`ring-${teeth}`}
              aria-pressed={selected}
              aria-label={`${teeth}-tooth ring gear`}
              onClick={() => onChange(teeth)}
            >
              <span className={styles.dial}>
                <span className={styles.circle} />
                {selected && <span className={styles.ring} />}
              </span>
              <span className={styles.teeth}>{teeth}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
