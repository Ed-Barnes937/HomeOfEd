import { gearPalette, MAX_GEARS, wheelOpts } from '../garden/engine/gears.ts'
import styles from './GearTrain.module.scss'

export interface GearTrainProps {
  wheels: number[]
  onAdd: (teeth: number) => void
  onRemove: (index: number) => void
}

/** The train chips (removable when >1 cog) + the wheel dock, dimmed at MAX_GEARS. */
export function GearTrain({ wheels, onAdd, onRemove }: GearTrainProps) {
  const atMax = wheels.length >= MAX_GEARS
  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.label}>Gear train</span>
        <span className={styles.value}>
          {wheels.length} {wheels.length === 1 ? 'cog' : 'cogs'}
        </span>
      </div>
      <div className={styles.chips}>
        {wheels.map((teeth, i) => {
          const [light, dark] = gearPalette(teeth)
          return (
            <span key={`${teeth}-${i}`} className={styles.chip} data-testid={`train-chip-${i}`}>
              <span
                className={styles.dot}
                style={{ background: `radial-gradient(circle at 35% 30%, ${light}, ${dark})` }}
              />
              <span className={styles.teeth}>{teeth}</span>
              {wheels.length > 1 && (
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove ${teeth}-tooth cog`}
                  data-testid={`train-chip-remove-${i}`}
                  onClick={() => onRemove(i)}
                >
                  ×
                </button>
              )}
            </span>
          )
        })}
      </div>
      <div className={styles.hint}>
        {atMax ? 'Max 3 cogs — remove one to add' : 'Tap to add a cog to the train'}
      </div>
      <div className={styles.dock}>
        {wheelOpts().map((teeth) => {
          const [light, dark] = gearPalette(teeth)
          const dim = Math.round(26 + ((teeth - 24) / (63 - 24)) * 20)
          return (
            <button
              key={teeth}
              type="button"
              className={styles.wheel}
              data-testid={`wheel-${teeth}`}
              aria-label={`Add ${teeth}-tooth cog`}
              disabled={atMax}
              style={{ opacity: atMax ? 0.32 : 1 }}
              onClick={() => onAdd(teeth)}
            >
              <span
                className={styles.wheelDot}
                style={{
                  width: dim,
                  height: dim,
                  background: `radial-gradient(circle at 35% 30%, ${light}, ${dark})`,
                }}
              />
              <span className={styles.wheelTeeth}>{teeth}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
