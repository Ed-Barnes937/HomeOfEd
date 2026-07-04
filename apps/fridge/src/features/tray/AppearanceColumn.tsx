import type { Finish, Wall } from '../board/model.ts'
import styles from './AppearanceColumn.module.scss'

const FINISHES: { key: Finish; label: string }[] = [
  { key: 'steel', label: 'Steel' },
  { key: 'white', label: 'White' },
  { key: 'red', label: 'Red' },
  { key: 'mint', label: 'Mint' },
]

const LIGHTS: { key: Wall; label: string }[] = [
  { key: 'warm', label: 'Warm' },
  { key: 'cool', label: 'Cool' },
  { key: 'dark', label: 'Night' },
]

/**
 * Fridge-finish and kitchen-light swatch rows. Active swatch gets an ink ring.
 * Selecting a swatch drives the board's finish / wall state via props.
 */
export function AppearanceColumn({
  finish,
  wall,
  onFinish,
  onWall,
}: {
  finish: Finish
  wall: Wall
  onFinish: (finish: Finish) => void
  onWall: (wall: Wall) => void
}) {
  return (
    <div className={styles.appearance}>
      <div>
        <div className={styles.cap}>Fridge finish</div>
        <div className={styles.row}>
          {FINISHES.map(({ key, label }) => (
            <div key={key} className={styles.group}>
              <button
                type="button"
                className={`${styles.swatch} ${styles[`finish-${key}`]}`}
                data-active={finish === key}
                aria-label={label}
                onClick={() => onFinish(key)}
              />
              <span className={styles.label}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className={styles.cap}>Kitchen light</div>
        <div className={styles.row}>
          {LIGHTS.map(({ key, label }) => (
            <div key={key} className={styles.group}>
              <button
                type="button"
                className={`${styles.swatch} ${styles[`light-${key}`]}`}
                data-active={wall === key}
                aria-label={label}
                onClick={() => onWall(key)}
              />
              <span className={styles.label}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
