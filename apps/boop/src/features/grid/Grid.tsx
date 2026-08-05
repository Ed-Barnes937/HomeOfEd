import type { CSSProperties } from 'react'

import { STEPS_PER_PATTERN, type Kit, type Pattern } from '../../engine/sequencerEngine.ts'
import styles from './Grid.module.scss'

const GROUP_SIZE = 4
const GROUP_COUNT = STEPS_PER_PATTERN / GROUP_SIZE

/**
 * The row colour hues from the design handoff, in the launch kit's fixed row
 * order (kick, snare, hi-hat, tom, marimba, boop). Positional, not a lookup by
 * `instrumentId` — the kit manifest has no colour field yet (kit content is a
 * separate ticket), and the engine contract must stay the only place
 * instruments are enumerated, so this indexes by row position rather than
 * naming instrument ids.
 */
const ROW_COLOR_VARS = [
  '--instrument-kick',
  '--instrument-snare',
  '--instrument-hihat',
  '--instrument-tom',
  '--instrument-marimba',
  '--instrument-boop',
] as const

interface GridProps {
  kit: Kit
  pattern: Pattern
  onToggleCell: (instrumentId: string, step: number) => void
}

/** The 6x16 grid well: bar-numeral row + instrument rows. No playhead or drag-paint yet (ticket 13). */
export function Grid({ kit, pattern, onToggleCell }: GridProps) {
  const groups = Array.from({ length: GROUP_COUNT }, (_, i) => i)

  return (
    <div className={styles.well}>
      <div className={styles.barNumerals} aria-hidden="true">
        <div className={styles.railSpacer} />
        {groups.map((group) => (
          <div key={group} className={styles.barNumeral}>
            {group + 1}
          </div>
        ))}
      </div>
      <div
        className={styles.body}
        role="application"
        aria-label="6 by 16 step grid. Tap a cell to turn a beat on or off."
      >
        {pattern.map((row, rowIndex) => {
          const instrument = kit.instruments[rowIndex]
          if (!instrument) return null
          const colorVar = ROW_COLOR_VARS[rowIndex % ROW_COLOR_VARS.length]
          const rowStyle = { '--row-color': `var(${colorVar})` } as CSSProperties

          return (
            <div key={row.instrumentId} className={styles.row} style={rowStyle}>
              <div className={styles.rail}>
                <span className={styles.plate}>
                  <span
                    className={styles.artwork}
                    style={{
                      maskImage: `url(${instrument.artwork})`,
                      WebkitMaskImage: `url(${instrument.artwork})`,
                    }}
                  />
                </span>
                <span className={styles.name}>{instrument.name}</span>
              </div>
              <div className={styles.steps}>
                {groups.map((group) => (
                  <div
                    key={group}
                    className={styles.group}
                    data-parity={group % 2 === 0 ? 'even' : 'odd'}
                  >
                    {Array.from({ length: GROUP_SIZE }, (_, i) => {
                      const step = group * GROUP_SIZE + i
                      const on = row.steps[step] === true
                      return (
                        <button
                          key={step}
                          type="button"
                          className={styles.cell}
                          data-parity={group % 2 === 0 ? 'even' : 'odd'}
                          data-active={on}
                          data-testid={`cell-${row.instrumentId}-${step}`}
                          aria-pressed={on}
                          aria-label={`${instrument.name}, step ${step + 1}, ${on ? 'on' : 'off'}`}
                          onClick={() => onToggleCell(row.instrumentId, step)}
                        >
                          {on && (
                            <span
                              className={styles.cellArtwork}
                              style={{
                                maskImage: `url(${instrument.artwork})`,
                                WebkitMaskImage: `url(${instrument.artwork})`,
                              }}
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
