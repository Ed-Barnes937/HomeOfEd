import { PALETTE, PALETTE_ORDER } from '../board/model.ts'
import styles from './ColorPicker.module.scss'

/**
 * Colour selector for newly-added magnets: an `auto` pill (cycles the palette)
 * plus the six swatches. Always visible now that the Words tab is gone (plan
 * §6). `pick` is a palette index or null for auto. Static in F4 (F5 wires it).
 */
export function ColorPicker({
  pick,
  onPick,
}: {
  pick: number | null
  onPick: (index: number | null) => void
}) {
  return (
    <div className={styles.picker}>
      <span className={styles.cap}>Color</span>
      <button
        type="button"
        className={styles.auto}
        data-active={pick === null}
        onClick={() => onPick(null)}
      >
        auto
      </button>
      {PALETTE_ORDER.map((key, i) => (
        <button
          key={key}
          type="button"
          className={styles.swatch}
          data-active={pick === i}
          style={{ background: PALETTE[key].main }}
          aria-label={key}
          onClick={() => onPick(i)}
        />
      ))}
    </div>
  )
}
