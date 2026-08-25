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
  ) => void
}

interface GridKeyboardNavOptions {
  rowCount: number
  stepCount: number
  onToggleCell: (instrumentId: string, step: number) => void
  /** The `instrumentId` at a given row index, in the same row order the grid renders — used to resolve an arrow move's target cell. */
  instrumentIdAt: (rowIndex: number) => string | undefined
  /**
   * The `data-testid` of a cell, matching what the caller renders. Defaults to
   * the grid's `cell-<id>-<step>`; the song bar's lane squares (ticket 15) use
   * their own ids but the same arrow-key model.
   */
  cellTestId?: (instrumentId: string, step: number) => string
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
}: GridKeyboardNavOptions): GridKeyboardNav {
  const containerRef = useRef<HTMLDivElement>(null)

  function focusCell(rowIndex: number, step: number) {
    const instrumentId = instrumentIdAt(rowIndex)
    if (instrumentId === undefined) return
    const target = containerRef.current?.querySelector<HTMLButtonElement>(
      `[data-testid="${cellTestId(instrumentId, step)}"]`,
    )
    target?.focus()
  }

  function onCellKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    rowIndex: number,
    step: number,
    instrumentId: string,
    isOn: boolean,
  ) {
    const delta = ARROW_DELTA[event.key]
    if (delta) {
      event.preventDefault()
      const nextRow = Math.min(rowCount - 1, Math.max(0, rowIndex + delta[0]))
      const nextStep = Math.min(stepCount - 1, Math.max(0, step + delta[1]))
      focusCell(nextRow, nextStep)
      return
    }
    if (event.key === 'Backspace') {
      // Remove, not toggle: an already-off cell stays off.
      event.preventDefault()
      if (isOn) onToggleCell(instrumentId, step)
    }
  }

  return { containerRef, onCellKeyDown }
}
