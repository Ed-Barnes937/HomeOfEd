import { useRef, type KeyboardEvent, type RefObject } from 'react'

const ARROW_DELTA: Readonly<Record<string, readonly [rowDelta: number, stepDelta: number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

export interface GridKeyboardNav {
  /** Attach to the grid's `role="application"` container so the moved-to cell can be queried inside it. */
  containerRef: RefObject<HTMLDivElement | null>
  /** Attach to every cell button, alongside its `rowIndex`/`step`/`instrumentId`/current on-state. */
  onCellKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    rowIndex: number,
    step: number,
    instrumentId: string,
    isOn: boolean,
    pitchIndex?: number,
  ) => void
}

interface GridKeyboardNavOptions {
  rowCount: number
  stepCount: number
  onToggleCell: (instrumentId: string, step: number, pitchIndex?: number) => void
  /** The `instrumentId` at a given row index, in the same row order the grid renders — used to resolve an arrow move's target cell. */
  instrumentIdAt: (rowIndex: number) => string | undefined
  /**
   * The `data-testid` of a cell, matching what the caller renders. Defaults to
   * the grid's `cell-<id>-<step>`; the song bar's lane squares (ticket 15) use
   * their own ids but the same arrow-key model.
   */
  cellTestId?: (instrumentId: string, step: number) => string
  /**
   * How many pitches row `rowIndex` holds, or `undefined` for a one-note row
   * (pitched-lane ticket 06). Up and down walk a lane before they leave it, so
   * a lane is the same grid model with a second axis inside the row.
   */
  lanePitchesAt?: (rowIndex: number) => number | undefined
  laneCellTestId?: (instrumentId: string, step: number, pitchIndex: number) => string
}

/**
 * Arrow-key movement, Backspace-to-remove for the grid (spec: "Accessibility
 * & input"; Enter needs no wiring here — a focused `<button>` already fires
 * `click` on Enter, which `useDragPaint`'s `onClick` already toggles). Shared
 * by `Grid` and `PhoneGrid` so the two renderers can't diverge in behaviour.
 * The cursor moves by focusing the target cell directly rather than a roving
 * `tabIndex`: every cell is a native `<button>`, already in the tab order, so
 * there is nothing to manage — the focus ring simply follows where `.focus()`
 * lands.
 */
export function useGridKeyboardNav({
  rowCount,
  stepCount,
  onToggleCell,
  instrumentIdAt,
  cellTestId = (instrumentId, step) => `cell-${instrumentId}-${step}`,
  lanePitchesAt = () => undefined,
  laneCellTestId = (instrumentId, step, pitchIndex) =>
    `lane-cell-${instrumentId}-${step}-${pitchIndex}`,
}: GridKeyboardNavOptions): GridKeyboardNav {
  const containerRef = useRef<HTMLDivElement>(null)

  /** Which cell of a lane an arrow lands on when it arrives from outside the row. */
  function focusCell(rowIndex: number, step: number, entry: 'top' | 'bottom' | number): boolean {
    const instrumentId = instrumentIdAt(rowIndex)
    if (instrumentId === undefined) return false
    const pitches = lanePitchesAt(rowIndex)
    const testId =
      pitches === undefined
        ? cellTestId(instrumentId, step)
        : laneCellTestId(
            instrumentId,
            step,
            typeof entry === 'number'
              ? Math.min(pitches - 1, Math.max(0, entry))
              : entry === 'top'
                ? pitches - 1
                : 0,
          )
    const cell = containerRef.current?.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)
    cell?.focus()
    return cell !== null && cell !== undefined
  }

  function onCellKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    rowIndex: number,
    step: number,
    instrumentId: string,
    isOn: boolean,
    pitchIndex?: number,
  ) {
    const delta = ARROW_DELTA[event.key]
    if (delta) {
      event.preventDefault()
      const nextStep = Math.min(stepCount - 1, Math.max(0, step + delta[1]))
      const up = delta[0] < 0
      const pitches = lanePitchesAt(rowIndex)
      if (delta[0] !== 0 && pitches !== undefined && pitchIndex !== undefined) {
        const nextPitch = pitchIndex + (up ? 1 : -1)
        if (nextPitch >= 0 && nextPitch < pitches) {
          focusCell(rowIndex, nextStep, nextPitch)
          return
        }
      }
      if (delta[0] === 0) {
        focusCell(rowIndex, nextStep, pitchIndex ?? 'top')
        return
      }
      // Leaving a row enters the next one at the end the move came from, so the
      // cursor keeps travelling in one direction - and a row with nothing to
      // focus (a collapsed lane) is stepped over rather than swallowing it.
      for (let row = rowIndex + delta[0]; row >= 0 && row < rowCount; row += delta[0]) {
        if (focusCell(row, nextStep, up ? 'bottom' : 'top')) return
      }
      return
    }
    if (event.key === 'Backspace') {
      // Remove, not toggle: an already-off cell stays off.
      event.preventDefault()
      if (isOn) onToggleCell(instrumentId, step, pitchIndex)
    }
  }

  return { containerRef, onCellKeyDown }
}
