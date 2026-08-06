import {
  useEffect,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { STEPS_PER_PATTERN, type Kit, type Pattern } from '../../engine/sequencerEngine.ts'
import styles from './Grid.module.scss'
import { decidePaintMode, paintModeToOn, type PaintMode } from './paintMode.ts'
import { stepToBar, stepToCol } from './playheadMotion.ts'

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
  /** The playhead's current column, or `null` to hide it cleanly (stopped). */
  playheadStep: number | null
  /** `${instrumentId}:${step}` -> strike epoch (ticket 17) — a cell's squash re-keys only on a real hit. */
  cellStrikes: Readonly<Record<string, number>>
  /** `instrumentId` -> strike epoch (ticket 17) — drives that row's label bob. */
  rowStrikes: Readonly<Record<string, number>>
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
export function Grid({ kit, pattern, onToggleCell, playheadStep, cellStrikes, rowStrikes }: GridProps) {
  const groups = Array.from({ length: GROUP_COUNT }, (_, i) => i)
  const paintModes = useRef(new Map<number, PaintMode>())

  useEffect(() => {
    const releasePointer = (event: PointerEvent) => paintModes.current.delete(event.pointerId)
    window.addEventListener('pointerup', releasePointer)
    window.addEventListener('pointercancel', releasePointer)
    return () => {
      window.removeEventListener('pointerup', releasePointer)
      window.removeEventListener('pointercancel', releasePointer)
    }
  }, [])

  const applyMode = (mode: PaintMode, instrumentId: string, step: number, isOn: boolean) => {
    if (isOn !== paintModeToOn(mode)) onToggleCell(instrumentId, step)
  }

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    instrumentId: string,
    step: number,
    isOn: boolean,
  ) => {
    const mode = decidePaintMode(isOn)
    paintModes.current.set(event.pointerId, mode)
    applyMode(mode, instrumentId, step, isOn)
    // Touch pointers get *implicit* capture to the pointerdown target (Pointer
    // Events spec); without releasing it, `pointerenter` never fires on
    // sibling cells on real touch hardware and the drag can't cross cells.
    // No-op for pointer types (mouse) that were never implicitly captured.
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handlePointerEnter = (
    event: ReactPointerEvent<HTMLButtonElement>,
    instrumentId: string,
    step: number,
    isOn: boolean,
  ) => {
    const mode = paintModes.current.get(event.pointerId)
    if (!mode) return
    applyMode(mode, instrumentId, step, isOn)
  }

  // Keyboard-triggered clicks (Enter/Space on a focused button) carry
  // `detail: 0`; real pointer clicks carry `detail >= 1`. Pointer taps and
  // drags are handled above (pointerdown decides, pointerenter repeats), so
  // this only needs to catch the keyboard path and must ignore the click a
  // pointer tap also fires after pointerup, or a tap would double-toggle.
  const handleClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    instrumentId: string,
    step: number,
  ) => {
    if (event.detail !== 0) return
    onToggleCell(instrumentId, step)
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
    <div className={styles.well}>
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
        className={styles.body}
        role="application"
        aria-label="6 by 16 step grid. Tap a cell to turn a beat on or off."
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
                        const strikeEpoch = cellStrikes[`${row.instrumentId}:${step}`] ?? 0
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
                              handlePointerDown(event, row.instrumentId, step, on)
                            }
                            onPointerEnter={(event) =>
                              handlePointerEnter(event, row.instrumentId, step, on)
                            }
                            onClick={(event) => handleClick(event, row.instrumentId, step)}
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
    </div>
  )
}
