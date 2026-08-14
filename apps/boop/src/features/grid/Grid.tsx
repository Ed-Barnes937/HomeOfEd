import type { CSSProperties, ReactNode } from 'react'

import { STEPS_PER_PATTERN, type Kit, type Pattern } from '../../engine/sequencerEngine.ts'
import styles from './Grid.module.scss'
import { ROW_COLOR_VARS } from './instrumentColors.ts'
import { stepToBar, stepToCol } from './playheadMotion.ts'
import { useDragPaint } from './useDragPaint.ts'
import { useGridKeyboardNav } from './useGridKeyboardNav.ts'
import { useLoadStagger } from './useLoadStagger.ts'

const GROUP_SIZE = 4
const GROUP_COUNT = STEPS_PER_PATTERN / GROUP_SIZE

/**
 * What either grid renderer needs. `Grid` and `PhoneGrid` are two views of the
 * same state, chosen by `useIsPhone` — they must never diverge in what they
 * are told, only in how they lay it out.
 */
export interface GridViewProps {
  kit: Kit
  pattern: Pattern
  onToggleCell: (instrumentId: string, step: number) => void
  /** The playhead's current column, or `null` to hide it cleanly (stopped). */
  playheadStep: number | null
  /** `${instrumentId}:${step}` -> strike epoch (ticket 17) — a cell's squash re-keys only on a real hit. */
  cellStrikes: Readonly<Record<string, number>>
  /** `instrumentId` -> strike epoch (ticket 17) — drives that row's label bob. */
  rowStrikes: Readonly<Record<string, number>>
  /**
   * Bumped by the caller each time a preset (including blank) is loaded —
   * distinct from a plain edit, so the cells that land can be staggered
   * across columns instead of all popping in at once (ticket 22).
   */
  loadToken: number
  /**
   * The active clip's tint (boop-loops ticket 15): the laptop layout wears it
   * as an inner ring on the well. Absent everywhere the clip chrome hasn't
   * landed yet (tablet/phone) — the well then looks exactly as it always has.
   */
  tintColor?: string
  /** Rendered inside the well, below the rows — the laptop clip control. */
  wellFooter?: ReactNode
}

/**
 * The 6x16 grid well: bar-numeral row + instrument rows, a sweeping playhead
 * column, and hit motion (squash on struck cells, bob on struck row labels) —
 * driven entirely by state the caller derives from the engine's draw-time
 * channel (`usePlayheadMotion`), never touched from here.
 *
 * Touch model (ticket 15, spec: "The grid"): pointer-down on a cell decides
 * add-or-remove from that cell's current state; the drag then repeats that
 * decision on every cell it crosses. Mode is tracked per pointer id (not
 * captured to one element) so multiple fingers can paint independently and
 * `pointerenter` still fires as a pointer crosses into other cells.
 */
export function Grid({
  kit,
  pattern,
  onToggleCell,
  playheadStep,
  cellStrikes,
  rowStrikes,
  loadToken,
  tintColor,
  wellFooter,
}: GridViewProps) {
  const groups = Array.from({ length: GROUP_COUNT }, (_, i) => i)
  const paint = useDragPaint({ onToggleCell, applyOnPointerDown: true })
  const staggerDelayFor = useLoadStagger(loadToken)
  const keyboardNav = useGridKeyboardNav({
    rowCount: pattern.length,
    stepCount: STEPS_PER_PATTERN,
    onToggleCell,
    instrumentIdAt: (rowIndex) => pattern[rowIndex]?.instrumentId,
  })

  const activeBar = playheadStep === null ? null : stepToBar(playheadStep)
  const playheadStyle =
    playheadStep === null
      ? undefined
      : ({
          '--group': stepToBar(playheadStep),
          '--col': stepToCol(playheadStep),
        } as CSSProperties)

  return (
    <div
      className={styles.well}
      data-tinted={tintColor !== undefined}
      style={tintColor !== undefined ? ({ '--clip-tint': tintColor } as CSSProperties) : undefined}
    >
      <div className={styles.barNumerals} aria-hidden="true">
        <div className={styles.railSpacer} />
        {groups.map((group) => (
          <div
            key={group}
            className={styles.barNumeral}
            data-active={group === activeBar}
            data-testid={`bar-numeral-${group}`}
          >
            {group + 1}
          </div>
        ))}
      </div>
      <div
        ref={keyboardNav.containerRef}
        className={styles.body}
        role="application"
        aria-label="6 by 16 step grid. Tap a cell to turn a beat on or off. Arrow keys move, Enter toggles, Backspace removes. Space plays or pauses."
      >
        {playheadStep !== null && (
          <div className={styles.playhead} style={playheadStyle} data-testid="playhead" data-step={playheadStep} />
        )}
        <div className={styles.rows}>
          {pattern.map((row, rowIndex) => {
            const instrument = kit.instruments[rowIndex]
            if (!instrument) return null
            const colorVar = ROW_COLOR_VARS[rowIndex % ROW_COLOR_VARS.length]
            const rowStyle = { '--row-color': `var(${colorVar})` } as CSSProperties
            const rowStrikeEpoch = rowStrikes[row.instrumentId] ?? 0

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
                  <span
                    key={rowStrikeEpoch}
                    className={styles.nameBob}
                    data-struck={rowStrikeEpoch > 0}
                    data-testid={`row-label-${row.instrumentId}`}
                  >
                    <span className={styles.name}>{instrument.name}</span>
                  </span>
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
                        const underPlayhead = step === playheadStep
                        const cellKey = `${row.instrumentId}:${step}`
                        const strikeEpoch = cellStrikes[cellKey] ?? 0
                        const mountDelay = staggerDelayFor(cellKey, step, on)
                        return (
                          <button
                            key={step}
                            type="button"
                            className={styles.cell}
                            data-parity={group % 2 === 0 ? 'even' : 'odd'}
                            data-active={on}
                            data-playhead={underPlayhead}
                            data-testid={`cell-${row.instrumentId}-${step}`}
                            aria-pressed={on}
                            aria-label={`${instrument.name}, step ${step + 1}, ${on ? 'on' : 'off'}`}
                            onPointerDown={(event) =>
                              paint.onPointerDown(event, row.instrumentId, step, on)
                            }
                            onPointerEnter={(event) =>
                              paint.onPointerEnter(event, row.instrumentId, step, on)
                            }
                            onClick={(event) => paint.onClick(event, row.instrumentId, step)}
                            onKeyDown={(event) =>
                              keyboardNav.onCellKeyDown(event, rowIndex, step, row.instrumentId, on)
                            }
                          >
                            <span
                              key={strikeEpoch}
                              className={styles.squash}
                              data-struck={strikeEpoch > 0}
                              data-testid={`cell-squash-${row.instrumentId}-${step}`}
                            >
                              {on && (
                                <span
                                  className={styles.cellArtwork}
                                  style={{
                                    maskImage: `url(${instrument.artwork})`,
                                    WebkitMaskImage: `url(${instrument.artwork})`,
                                    animationDelay: mountDelay > 0 ? `${mountDelay}ms` : undefined,
                                  }}
                                />
                              )}
                            </span>
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
      {wellFooter}
    </div>
  )
}
