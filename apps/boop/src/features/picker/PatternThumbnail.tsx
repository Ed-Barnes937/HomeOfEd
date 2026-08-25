import type { SampleRowSteps } from './sampleClips.ts'
import styles from './PatternThumbnail.module.scss'

interface PatternThumbnailProps {
  rows: readonly SampleRowSteps[]
}

/**
 * The 16x6 dot-matrix preview from the design handoff (§4 — "the same dot
 * matrix ... dots `#14262A` for active steps"): one dot per cell. Reads
 * straight off position-only rows, with no need to know which kit is loaded.
 *
 * Ink on paper, one flat colour, because both places it appears are paper
 * cards: the "My boops" list and the "+ New clip" picker's cards (ticket 17,
 * which retired the starter cards it was born on). The stage variant, whose
 * active dots took their row's instrument hue, went with the preset row.
 */
export function PatternThumbnail({ rows }: PatternThumbnailProps) {
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
