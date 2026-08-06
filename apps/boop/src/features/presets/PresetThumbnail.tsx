import type { CSSProperties } from 'react'

import { ROW_COLOR_VARS } from '../grid/instrumentColors.ts'
import type { PresetRowSteps } from './presets.ts'
import styles from './PresetThumbnail.module.scss'

interface PresetThumbnailProps {
  rows: readonly PresetRowSteps[]
}

/**
 * The 16x6 dot-matrix preview from the design handoff ("Preset row" —
 * "Thumbnail"): one dot per cell. Active dots take that row's instrument
 * colour (positional, same mapping the grid itself uses — see
 * `instrumentColors.ts`) so the blank preset still reads as the shape of the
 * grid rather than nothing. Reads straight off the preset's position-only
 * rows, with no need to know which kit is loaded.
 */
export function PresetThumbnail({ rows }: PresetThumbnailProps) {
  return (
    <div className={styles.matrix} aria-hidden="true">
      {rows.map((row, rowIndex) => {
        const colorVar = ROW_COLOR_VARS[rowIndex % ROW_COLOR_VARS.length]
        return (
          <div key={rowIndex} className={styles.row}>
            {row.steps.map((on, step) => (
              <span
                key={step}
                className={styles.dot}
                data-active={on}
                style={on ? ({ '--dot-color': `var(${colorVar})` } as CSSProperties) : undefined}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
