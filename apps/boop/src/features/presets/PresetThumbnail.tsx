import type { CSSProperties } from 'react'

import { ROW_COLOR_VARS } from '../grid/instrumentColors.ts'
import type { PresetRowSteps } from './presets.ts'
import styles from './PresetThumbnail.module.scss'

interface PresetThumbnailProps {
  rows: readonly PresetRowSteps[]
  /**
   * `'stage'` (default): the preset row's card on the dark stage, active dots
   * take their row's instrument colour. `'paper'`: the "My grooves" list's
   * light paper card (design handoff §4 — "the same dot matrix ... dots
   * `#14262A` for active steps"), one flat ink colour instead of per-row hues.
   */
  tone?: 'stage' | 'paper'
}

/**
 * The 16x6 dot-matrix preview from the design handoff ("Preset row" —
 * "Thumbnail"; reused for "My grooves" row thumbnails, §4): one dot per cell.
 * Reads straight off the preset's position-only rows, with no need to know
 * which kit is loaded.
 */
export function PresetThumbnail({ rows, tone = 'stage' }: PresetThumbnailProps) {
  return (
    <div className={styles.matrix} data-tone={tone} aria-hidden="true">
      {rows.map((row, rowIndex) => {
        const colorVar = ROW_COLOR_VARS[rowIndex % ROW_COLOR_VARS.length]
        return (
          <div key={rowIndex} className={styles.row}>
            {row.steps.map((on, step) => (
              <span
                key={step}
                className={styles.dot}
                data-active={on}
                style={
                  on && tone === 'stage' ? ({ '--dot-color': `var(${colorVar})` } as CSSProperties) : undefined
                }
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
