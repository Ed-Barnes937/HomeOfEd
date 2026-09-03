import { useMemo, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'

import { STEPS_PER_PATTERN, type Kit, type Pattern } from '../../engine/sequencerEngine.ts'
import { SCRUB_SEGMENT_ATTR, scrubKeyMove, useScrubDrag } from '../playhead/useScrubDrag.ts'
import styles from './Grid.module.scss'
import { rowColorVar } from './instrumentColors.ts'
import { stepToBar, stepToCol } from './playheadMotion.ts'
import { instrumentsById } from './rowInstruments.ts'
import { useDragPaint } from './useDragPaint.ts'
import { useGridKeyboardNav } from './useGridKeyboardNav.ts'
import { useLoadStagger } from './useLoadStagger.ts'

const GROUP_SIZE = 4
const GROUP_COUNT = STEPS_PER_PATTERN / GROUP_SIZE
const STEPS = Array.from({ length: STEPS_PER_PATTERN }, (_, step) => step)

/**
 * What either grid renderer needs. `Grid` and `PhoneGrid` are two views of the
 * same state, chosen by `useIsPhone` — they must never diverge in what they
 * are told, only in how they lay it out.
 */
export interface GridViewProps {
  kit: Kit
  pattern: Pattern
  onToggleCell: (instrumentId: string, step: number) => void
  /**
   * The playhead's column — the last step that sounded, or `null` when nothing
   * has yet. Since boop-playhead ticket 04 a stop is not one of those: the
   * playhead stays on its step, so this outlives playback.
   */
  playheadStep: number | null
  /**
   * Whether the transport is running. The playhead no longer unmounts on a stop
   * (spec §1) — it stays put at 45% opacity — so this is what tells a stopped
   * playhead from a playing one.
   */
  playheadPlaying: boolean
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
   * The clip rail's scrub (boop-playhead ticket 05, spec §4): move the playhead
   * to a step of the clip on the grid. Snapped to a step by the caller's own
   * geometry, so this is a step index, never a coordinate.
   */
  onScrubToStep: (step: number) => void
  /** Home on either scrub track: back to the start of the song (spec §4). */
  onScrubToSongStart: () => void
  /**
   * The active clip's tint (boop-loops ticket 15): the laptop layout wears it
   * as an inner ring on the well. Absent everywhere the clip chrome hasn't
   * landed yet (tablet/phone) — the well then looks exactly as it always has.
   */
  tintColor?: string
  /**
   * A row's rail artwork was tapped (ticket 05): open the instrument picker on
   * that row. Addressed by **row index**, not by the instrument it holds —
   * index is a row's identity on the grid (the hues are positional), and it is
   * what `swapRowInstrument`/`removeRow` take.
   */
  onOpenInstrumentPicker: (rowIndex: number) => void
  /**
   * "+ Add a sound" was tapped (ticket 06): open the picker in append mode. The
   * button has no row of its own - the row it makes lands at the bottom.
   */
  onAddRow: () => void
  /**
   * Whether there is a sound left to add. False only at the whole roster, where
   * the button is disabled rather than hidden: it is where a child looks, so it
   * has to be there saying why (spec §4).
   */
  canAddRow: boolean
  /** Rendered inside the well, below the rows — the laptop clip control. */
  wellFooter?: ReactNode
}

/**
 * The grid well: bar-numeral row + the clip's own instrument rows (ADR 0042,
 * so a row's artwork and name come from the kit by id), a sweeping playhead
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
  playheadPlaying,
  cellStrikes,
  rowStrikes,
  loadToken,
  onScrubToStep,
  onScrubToSongStart,
  onOpenInstrumentPicker,
  onAddRow,
  canAddRow,
  tintColor,
  wellFooter,
}: GridViewProps) {
  const groups = Array.from({ length: GROUP_COUNT }, (_, i) => i)
  const instruments = useMemo(() => instrumentsById(kit), [kit])
  const paint = useDragPaint({ onToggleCell, applyOnPointerDown: true })
  const staggerDelayFor = useLoadStagger(loadToken)
  const keyboardNav = useGridKeyboardNav({
    rowCount: pattern.length,
    stepCount: STEPS_PER_PATTERN,
    onToggleCell,
    instrumentIdAt: (rowIndex) => pattern[rowIndex]?.instrumentId,
  })

  // The clip rail (boop-playhead handoff, "Clip rail"): a tick per step on
  // `.steps`' own geometry, tapped or dragged to move the playhead.
  const railScrub = useScrubDrag(({ segment }) => onScrubToStep(segment))
  const onRailKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = playheadStep ?? 0
    const moved = scrubKeyMove(event.key, {
      // `scrubToStep` clamps to the pattern, so the rail never leaves its clip.
      onStep: (delta) => onScrubToStep(step + delta),
      onSongStart: onScrubToSongStart,
    })
    if (moved) event.preventDefault()
  }

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
      <div className={styles.wellScroll} data-testid="grid-scroll">
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
        <div className={styles.railRow}>
          <span className={styles.railLabel}>THIS CLIP</span>
          <div
            className={styles.railTrack}
            role="slider"
            tabIndex={0}
            aria-label="This clip. Drag to move the playhead."
            aria-valuemin={0}
            aria-valuemax={STEPS_PER_PATTERN - 1}
            aria-valuenow={playheadStep ?? 0}
            aria-valuetext={`Step ${(playheadStep ?? 0) + 1}`}
            onKeyDown={onRailKeyDown}
            onPointerDown={railScrub.onPointerDown}
            onPointerMove={railScrub.onPointerMove}
            onPointerUp={railScrub.onPointerUp}
            onPointerCancel={railScrub.onPointerCancel}
            data-testid="clip-rail"
          >
            {groups.map((group) => (
              <div key={group} className={styles.railGroup}>
                {STEPS.slice(group * GROUP_SIZE, (group + 1) * GROUP_SIZE).map((step) => (
                  <span
                    key={step}
                    className={styles.railTick}
                    {...{ [SCRUB_SEGMENT_ATTR]: '' }}
                    data-current={step === playheadStep}
                    data-playing={playheadPlaying}
                    data-testid={`clip-rail-tick-${step}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div
          ref={keyboardNav.containerRef}
          className={styles.body}
          role="application"
          // The clip's own row count, not a constant six: a clip holds 1..the
          // roster since ADR 0042, and what is announced has to be what is there.
          aria-label={`${pattern.length} by ${STEPS_PER_PATTERN} step grid. Tap a cell to turn a beat on or off. Arrow keys move, Enter toggles, Backspace removes. Space plays or pauses.`}
        >
          {playheadStep !== null && (
            <div
              className={styles.playhead}
              style={playheadStyle}
              data-testid="playhead"
              data-step={playheadStep}
              data-playing={playheadPlaying}
            />
          )}
          <div className={styles.rows}>
            {pattern.map((row, rowIndex) => {
              const instrument = instruments.get(row.instrumentId)
              if (!instrument) return null
              const rowStyle = { '--row-color': `var(${rowColorVar(rowIndex)})` } as CSSProperties
              const rowStrikeEpoch = rowStrikes[row.instrumentId] ?? 0

              return (
                <div key={row.instrumentId} className={styles.row} style={rowStyle}>
                  <div className={styles.rail}>
                    {/* The artwork is the row's instrument button (ticket 05,
                        spec §4): the thing that shows the sound is the thing
                        that changes it. */}
                    <button
                      type="button"
                      className={styles.plate}
                      onClick={() => onOpenInstrumentPicker(rowIndex)}
                      aria-label={`${instrument.name}. Change this row's sound.`}
                      data-testid={`row-instrument-button-${row.instrumentId}`}
                    >
                      <span
                        className={styles.artwork}
                        style={{
                          maskImage: `url(${instrument.artwork})`,
                          WebkitMaskImage: `url(${instrument.artwork})`,
                        }}
                      />
                    </button>
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
                                keyboardNav.onCellKeyDown(
                                  event,
                                  rowIndex,
                                  step,
                                  row.instrumentId,
                                  on,
                                )
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
                                      animationDelay:
                                        mountDelay > 0 ? `${mountDelay}ms` : undefined,
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
        {/* "+ Add a sound" (ticket 06, spec §4): under the last row and *inside*
            the well's rows box, so it scrolls with the rows while the clip play
            footer below stays pinned (ADR 0030 as amended by ticket 23). It is
            aligned with the rail, where the row labels are: it belongs to the
            rows, not to a step column. */}
        <div className={styles.addRow}>
          <button
            type="button"
            className={styles.addRowButton}
            onClick={onAddRow}
            disabled={!canAddRow}
            aria-label={
              canAddRow ? 'Add a sound' : 'Add a sound. Every sound is already in this clip.'
            }
            data-testid="add-row-button"
          >
            + Add a sound
          </button>
        </div>
      </div>
      {wellFooter && <div className={styles.wellFooter}>{wellFooter}</div>}
    </div>
  )
}
