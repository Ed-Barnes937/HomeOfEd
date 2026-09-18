import { useEffect, useMemo, useRef, useState, type CSSProperties, type UIEvent } from 'react'

import { rowPitchMasks } from '../../engine/pitch.ts'
import { PITCHES_PER_LANE, STEPS_PER_PATTERN } from '../../engine/sequencerEngine.ts'
import type { GridViewProps } from './Grid.tsx'
import { rowColorVar } from './instrumentColors.ts'
import { LoopMap } from './LoopMap.tsx'
import styles from './PhoneGrid.module.scss'
import { PHONE_WINDOW_WIDTH, phoneOffscreenSide } from './phoneWindow.ts'
import { LaneSummary, LaneToggle, MiniContour, PitchedLane, PitchKey } from './PitchedLane.tsx'
import { stepToBar, stepToCol } from './playheadMotion.ts'
import { instrumentsById } from './rowInstruments.ts'
import { useCollapsedRows } from './useCollapsedRows.ts'
import { useDragPaint } from './useDragPaint.ts'
import { useGridKeyboardNav } from './useGridKeyboardNav.ts'
import { useLoadStagger } from './useLoadStagger.ts'

const GROUP_SIZE = 4
const GROUP_COUNT = STEPS_PER_PATTERN / GROUP_SIZE

/**
 * The small-phone grid (ticket 27; design handoff, "Main screen — small
 * phone"). The grid never drops a row or a column: **16 steps always, and
 * every row the clip has** (ADR 0027, as amended by ADR 0042).
 * Instead the instrument rail is pinned at 92px and the 16 step
 * columns scroll horizontally inside a ~246px window that snaps to the 4-step
 * groups, so a swipe always lands on a bar line. The part-cut cell at the
 * window's edge is kept deliberately: it is the affordance that says there is
 * more this way.
 *
 * **Paint vs scroll.** Inside the window the browser owns horizontal pans
 * (`touch-action: pan-x` on the strip) — a sideways swipe scrolls and snaps,
 * and never paints. Everything else is ours: a tap toggles one cell, and a
 * drag that crosses a cell boundary paints, latched from the cell it started
 * on. The first cell is deliberately *not* flipped on pointer-down (see
 * `useDragPaint`'s `applyOnPointerDown`), so a child swiping to the next bar
 * never comes back to a note they didn't mean to make. Ticket 15's blanket
 * `touch-action: none` on the desktop grid body would make the window
 * unscrollable, so the phone relaxes it to `pan-x` on the window only —
 * pinch-zoom on the page still works either way.
 *
 * **Playback never scrolls the window.** The loop map below carries the
 * playhead when it is out of view, and an edge glow says which way to swipe
 * back — a child's scroll position is never yanked. Since boop-playhead ticket
 * 06 that map is also the phone's clip scrubber, so the scrub props of
 * `GridViewProps` go straight through to it.
 *
 * **A pitched row** is a lane of eight notes on those same columns, and needs
 * no gesture of its own: the vertical axis in here was already paint's, not
 * scroll's (ADR 0063).
 */
export function PhoneGrid({
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
  wellFooter,
}: GridViewProps) {
  const groups = Array.from({ length: GROUP_COUNT }, (_, i) => i)
  const instruments = useMemo(() => instrumentsById(kit), [kit])
  const paint = useDragPaint({ onToggleCell, applyOnPointerDown: false })
  const staggerDelayFor = useLoadStagger(loadToken)
  const collapsedRows = useCollapsedRows()
  // One derivation for both columns: the pinned rail and the scrolling steps
  // are separate trees that have to agree row for row, lane state included.
  const rows = pattern.flatMap((row, rowIndex) => {
    const instrument = instruments.get(row.instrumentId)
    if (!instrument) return []
    const pitched = instrument.pitched !== undefined
    const collapsed = pitched && collapsedRows.isCollapsed(row.instrumentId)
    return [
      {
        row,
        rowIndex,
        instrument,
        pitched,
        collapsed,
        masks: pitched ? rowPitchMasks(row) : [],
        lane: pitched ? (collapsed ? 'collapsed' : 'expanded') : undefined,
        style: { '--row-color': `var(${rowColorVar(rowIndex)})` } as CSSProperties,
      },
    ]
  })
  const keyboardNav = useGridKeyboardNav({
    rowCount: pattern.length,
    stepCount: STEPS_PER_PATTERN,
    onToggleCell,
    instrumentIdAt: (rowIndex) => pattern[rowIndex]?.instrumentId,
    lanePitchesAt: (rowIndex) =>
      instruments.get(pattern[rowIndex]?.instrumentId ?? '')?.pitched === undefined
        ? undefined
        : PITCHES_PER_LANE,
  })

  const windowRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [windowWidth, setWindowWidth] = useState(PHONE_WINDOW_WIDTH)

  // The window is a flex child, so its width is the phone's, not a constant —
  // measured so the snap maths, the loop-map bracket and the off-screen test
  // all describe the window this child actually has.
  useEffect(() => {
    const element = windowRef.current
    if (!element) return
    const measure = () => setWindowWidth(element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const onScroll = (event: UIEvent<HTMLDivElement>) => setScrollLeft(event.currentTarget.scrollLeft)

  const offscreen = phoneOffscreenSide(playheadStep, scrollLeft, windowWidth)
  const activeBar = playheadStep === null ? null : stepToBar(playheadStep)
  const playheadStyle =
    playheadStep === null
      ? undefined
      : ({ '--group': stepToBar(playheadStep), '--col': stepToCol(playheadStep) } as CSSProperties)

  return (
    <div className={styles.well}>
      <div className={styles.wellScroll} data-testid="grid-scroll">
        <div className={styles.layout}>
          <div className={styles.railCol}>
            <div className={styles.barSpacer} aria-hidden="true" />
            <div className={styles.railRows}>
              {rows.map(({ row, rowIndex, instrument, pitched, collapsed, masks, lane, style }) => {
                const rowStrikeEpoch = rowStrikes[row.instrumentId] ?? 0
                // The rail is pinned, so this button is always reachable - the
                // phone's one route into the instrument picker (ticket 05).
                const plate = (
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
                )
                const name = (
                  <span
                    key={rowStrikeEpoch}
                    className={styles.nameBob}
                    data-struck={rowStrikeEpoch > 0}
                    data-testid={`row-label-${row.instrumentId}`}
                  >
                    <span className={styles.name}>{instrument.name}</span>
                  </span>
                )
                return (
                  <div
                    key={row.instrumentId}
                    className={styles.railRow}
                    data-lane={lane}
                    style={style}
                  >
                    {pitched ? (
                      <>
                        {/* A 92px rail cannot hold the plate, a name and a 44px
                            chevron on one line (ADR 0063). */}
                        <span className={styles.railHead}>
                          {plate}
                          <LaneToggle
                            instrumentId={row.instrumentId}
                            instrumentName={instrument.name}
                            collapsed={collapsed}
                            onToggleCollapsed={() => collapsedRows.toggle(row.instrumentId)}
                          />
                        </span>
                        <span className={styles.railNameLine}>
                          {name}
                          {collapsed && (
                            <MiniContour instrumentId={row.instrumentId} masks={masks} />
                          )}
                        </span>
                        {!collapsed && <PitchKey />}
                      </>
                    ) : (
                      <>
                        {plate}
                        {name}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className={styles.windowWrap}>
            <div
              ref={windowRef}
              className={styles.window}
              onScroll={onScroll}
              data-testid="phone-step-window"
            >
              <div className={styles.strip}>
                <div className={styles.barNumerals} aria-hidden="true">
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
                  // The clip's own row count, as on the laptop (ADR 0042).
                  aria-label={`${pattern.length} by ${STEPS_PER_PATTERN} step grid. Tap a cell to turn a beat on or off. Arrow keys move, Enter toggles, Backspace removes. Space plays or pauses. Swipe sideways for the other bars.`}
                >
                  <div className={styles.playheadLayer} aria-hidden="true">
                    {playheadStep !== null && (
                      <div
                        className={styles.playhead}
                        style={playheadStyle}
                        data-testid="playhead"
                        data-step={playheadStep}
                        data-playing={playheadPlaying}
                      />
                    )}
                  </div>
                  <div className={styles.rows}>
                    {rows.map(
                      ({ row, rowIndex, instrument, pitched, collapsed, masks, lane, style }) => (
                        <div
                          key={row.instrumentId}
                          className={styles.stepsRow}
                          data-lane={lane}
                          style={style}
                        >
                          {collapsed ? (
                            <LaneSummary
                              instrumentId={row.instrumentId}
                              masks={masks}
                              playheadStep={playheadStep}
                              onExpand={() => collapsedRows.toggle(row.instrumentId)}
                            />
                          ) : pitched ? (
                            <PitchedLane
                              instrumentId={row.instrumentId}
                              instrumentName={instrument.name}
                              masks={masks}
                              playheadStep={playheadStep}
                              paint={paint}
                              onCellKeyDown={(event, step, pitchIndex, on) =>
                                keyboardNav.onCellKeyDown(
                                  event,
                                  rowIndex,
                                  step,
                                  row.instrumentId,
                                  on,
                                  pitchIndex,
                                )
                              }
                            />
                          ) : (
                            groups.map((group) => (
                              <div key={group} className={styles.group}>
                                {Array.from({ length: GROUP_SIZE }, (_, i) => {
                                  const step = group * GROUP_SIZE + i
                                  const on = row.steps[step] === true
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
                                      data-playhead={step === playheadStep}
                                      data-testid={`cell-${row.instrumentId}-${step}`}
                                      aria-pressed={on}
                                      aria-label={`${instrument.name}, step ${step + 1}, ${on ? 'on' : 'off'}`}
                                      onPointerDown={(event) =>
                                        paint.onPointerDown(event, row.instrumentId, step, on)
                                      }
                                      onPointerEnter={(event) =>
                                        paint.onPointerEnter(event, row.instrumentId, step, on)
                                      }
                                      onClick={(event) =>
                                        paint.onClick(event, row.instrumentId, step)
                                      }
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
                                            className={styles.pebble}
                                            style={{
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
                            ))
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
            {offscreen !== null && (
              <div
                className={styles.edgeGlow}
                data-side={offscreen}
                data-testid="playhead-edge-glow"
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        {/* "+ Add a sound" (ticket 06, spec §4): the same button the laptop
            has, under the rows and inside the well's scroll box, so it scrolls
            with them while the loop map and clip play stay pinned. It sits
            under both columns rather than inside the 92px rail, which is the
            only place a phone has room for its label. */}
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

      <div className={styles.loopMapFooter}>
        <LoopMap
          pattern={pattern}
          playheadStep={playheadStep}
          playheadPlaying={playheadPlaying}
          scrollLeft={scrollLeft}
          onScrubToStep={onScrubToStep}
          onScrubToSongStart={onScrubToSongStart}
        />
      </div>

      {/* Clip play, pinned under the rows and the map the way it is at ≥1024
          (screenspace ticket 03). The phone used to reach it on the pinned
          transport beside the grid; the grid is in a card now and the dock's
          launcher is behind that card's backdrop, so without this there would
          be no way to hear the clip you are editing. */}
      {wellFooter && <div className={styles.wellFooter}>{wellFooter}</div>}
    </div>
  )
}
