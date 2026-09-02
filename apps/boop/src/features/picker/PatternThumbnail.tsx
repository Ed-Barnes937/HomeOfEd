import type { CSSProperties } from 'react'

import type { SampleRowSteps } from './sampleClips.ts'
import styles from './PatternThumbnail.module.scss'
import { thumbnailRowGeometry } from './thumbnailGeometry.ts'

interface PatternThumbnailProps {
  rows: readonly SampleRowSteps[]
}

/**
 * The 16-wide dot-matrix preview from the design handoff (§4 — "the same dot
 * matrix ... dots `#14262A` for active steps"): one dot per cell. Reads
 * straight off position-only rows, with no need to know which kit is loaded.
 *
 * The row count is **the clip's own** (ADR 0041), not the handoff's six: a
 * one-row clip draws one row and a twenty-row clip draws twenty, both inside
 * the same fixed box, because the layouts either side of a thumbnail must not
 * move as a child adds sounds. `thumbnailGeometry.ts` owns that rule; six rows
 * or fewer come out pixel-identical to the handoff.
 *
 * Ink on paper, one flat colour, because both places it appears are paper
 * cards: the "My boops" list and the "+ New clip" picker's cards (ticket 17,
 * which retired the starter cards it was born on). The stage variant, whose
 * active dots took their row's instrument hue, went with the preset row — and
 * the flat-ink tone is the handoff's own choice for the paper cards (§1, as
 * amended by ticket 36), so many rows read as texture in ink rather than in
 * cycling hues.
 */
export function PatternThumbnail({ rows }: PatternThumbnailProps) {
  const dense = thumbnailRowGeometry(rows.length)
  const denseStyle = dense
    ? ({
        '--row-pitch': `${dense.rowPitchPercent}%`,
        '--dot-height': `${dense.dotHeightPercent}%`,
      } as CSSProperties)
    : undefined

  return (
    <div
      className={styles.matrix}
      style={denseStyle}
      data-dense={dense !== null}
      data-rows={rows.length}
      aria-hidden="true"
      data-testid="pattern-thumbnail"
    >
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
