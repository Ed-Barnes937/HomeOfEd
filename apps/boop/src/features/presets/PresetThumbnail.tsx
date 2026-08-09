import type { PresetRowSteps } from './presets.ts'
import styles from './PresetThumbnail.module.scss'

interface PresetThumbnailProps {
  rows: readonly PresetRowSteps[]
}

/**
 * The 16x6 dot-matrix preview from the design handoff (§4 — "the same dot
 * matrix ... dots `#14262A` for active steps"): one dot per cell. Reads
 * straight off position-only rows, with no need to know which kit is loaded.
 *
 * Ink on paper, one flat colour, because both places it appears are now paper
 * cards: the "My boops" list and — since ticket 36 — the starter cards, which
 * left the dark stage for the "New boop" dialog. The stage variant, whose
 * active dots took their row's instrument hue, went with the preset row.
 */
export function PresetThumbnail({ rows }: PresetThumbnailProps) {
  return (
    <div className={styles.matrix} aria-hidden="true">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className={styles.row}>
          {row.steps.map((on, step) => (
            <span key={step} className={styles.dot} data-active={on} />
          ))}
        </div>
      ))}
    </div>
  )
}
