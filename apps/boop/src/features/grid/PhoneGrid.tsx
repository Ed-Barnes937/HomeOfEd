import { useEffect, useRef, useState, type CSSProperties, type UIEvent } from 'react'

import { STEPS_PER_PATTERN } from '../../engine/sequencerEngine.ts'
import type { GridViewProps } from './Grid.tsx'
import { ROW_COLOR_VARS } from './instrumentColors.ts'
import { LoopMap } from './LoopMap.tsx'
import styles from './PhoneGrid.module.scss'
import { PHONE_WINDOW_WIDTH, phoneOffscreenSide } from './phoneWindow.ts'
import { stepToBar, stepToCol } from './playheadMotion.ts'
import { useDragPaint } from './useDragPaint.ts'
import { useGridKeyboardNav } from './useGridKeyboardNav.ts'
import { useLoadStagger } from './useLoadStagger.ts'

const GROUP_SIZE = 4
const GROUP_COUNT = STEPS_PER_PATTERN / GROUP_SIZE

/**
 * The small-phone grid (ticket 27; design handoff, "Main screen — small
 * phone"). The grid stays **6 x 16, always** — no row or column is ever
 * dropped. Instead the instrument rail is pinned at 92px and the 16 step
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
 * back — a child's scroll position is never yanked.
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
}: GridViewProps) {
  const groups = Array.from({ length: GROUP_COUNT }, (_, i) => i)
  const paint = useDragPaint({ onToggleCell, applyOnPointerDown: false })
  const staggerDelayFor = useLoadStagger(loadToken)
  const keyboardNav = useGridKeyboardNav({
    rowCount: pattern.length,
    stepCount: STEPS_PER_PATTERN,
    onToggleCell,
    instrumentIdAt: (rowIndex) => pattern[rowIndex]?.instrumentId,
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
      <div className={styles.layout}>
        <div className={styles.railCol}>
          <div className={styles.barSpacer} aria-hidden="true" />
          <div className={styles.railRows}>
            {pattern.map((row, rowIndex) => {
              const instrument = kit.instruments[rowIndex]
              if (!instrument) return null
              const colorVar = ROW_COLOR_VARS[rowIndex % ROW_COLOR_VARS.length]
              const rowStrikeEpoch = rowStrikes[row.instrumentId] ?? 0
              return (
                <div
                  key={row.instrumentId}
                  className={styles.railRow}
                  style={{ '--row-color': `var(${colorVar})` } as CSSProperties}
                >
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
                aria-label="6 by 16 step grid. Tap a cell to turn a beat on or off. Arrow keys move, Enter toggles, Backspace removes. Space plays or pauses. Swipe sideways for the other bars."
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
                  {pattern.map((row, rowIndex) => {
                    const instrument = kit.instruments[rowIndex]
                    if (!instrument) return null
                    const colorVar = ROW_COLOR_VARS[rowIndex % ROW_COLOR_VARS.length]
                    return (
                      <div
                        key={row.instrumentId}
                        className={styles.stepsRow}
                        style={{ '--row-color': `var(${colorVar})` } as CSSProperties}
                      >
                        {groups.map((group) => (
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
                        ))}
                      </div>
                    )
                  })}
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

      <LoopMap pattern={pattern} playheadStep={playheadStep} scrollLeft={scrollLeft} />
    </div>
  )
}
