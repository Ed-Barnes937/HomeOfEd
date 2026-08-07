import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

import { decidePaintMode, paintModeToOn, type PaintMode } from './paintMode.ts'

interface Origin {
  instrumentId: string
  step: number
  isOn: boolean
}

interface Latch {
  mode: PaintMode
  origin: Origin
  /** Whether this drag has painted anything yet (deferred mode only). */
  applied: boolean
}

export interface DragPaintHandlers {
  onPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    instrumentId: string,
    step: number,
    isOn: boolean,
  ) => void
  onPointerEnter: (
    event: ReactPointerEvent<HTMLButtonElement>,
    instrumentId: string,
    step: number,
    isOn: boolean,
  ) => void
  onClick: (event: ReactMouseEvent<HTMLButtonElement>, instrumentId: string, step: number) => void
}

interface DragPaintOptions {
  onToggleCell: (instrumentId: string, step: number) => void
  /**
   * `true` (desktop): the pointer-down cell flips immediately — the original
   * ticket-15 behaviour, and the right one when nothing competes for the
   * gesture.
   *
   * `false` (the phone step window, ticket 27): hold the decision until the
   * drag actually crosses into another cell. Inside the scroll window the
   * browser owns horizontal pans, so pointer-down on a cell is just as likely
   * to be the start of a swipe to the next bar as the start of a paint — and a
   * child swiping must never come back to a flipped note. A plain tap still
   * toggles, via the `click` that a scroll gesture never produces.
   */
  applyOnPointerDown: boolean
}

/**
 * Latched drag-paint (spec: "The grid"; design handoff: "Latched drag-paint").
 * Pointer-down on a cell decides add-or-remove from that cell's state and the
 * whole drag repeats that one decision. Tracked per pointer id — not captured
 * to one element — so two fingers paint independently and `pointerenter` keeps
 * firing as a pointer crosses cells.
 */
export function useDragPaint({ onToggleCell, applyOnPointerDown }: DragPaintOptions): DragPaintHandlers {
  const latches = useRef(new Map<number, Latch>())
  // Set when a drag painted something; consumed by the `click` that a
  // pointer-up over the origin cell still fires, so a drag that wanders back
  // where it started doesn't undo its own first cell.
  const painted = useRef(false)

  useEffect(() => {
    const release = (event: PointerEvent) => latches.current.delete(event.pointerId)
    window.addEventListener('pointerup', release)
    // Fired when the browser claims the gesture — a horizontal pan of the
    // phone step window. Dropping the latch is what stops a swipe painting.
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [])

  const applyMode = (mode: PaintMode, instrumentId: string, step: number, isOn: boolean) => {
    if (isOn !== paintModeToOn(mode)) onToggleCell(instrumentId, step)
  }

  const onPointerDown: DragPaintHandlers['onPointerDown'] = (event, instrumentId, step, isOn) => {
    painted.current = false
    const mode = decidePaintMode(isOn)
    latches.current.set(event.pointerId, {
      mode,
      origin: { instrumentId, step, isOn },
      applied: applyOnPointerDown,
    })
    if (applyOnPointerDown) applyMode(mode, instrumentId, step, isOn)
    // Touch pointers get *implicit* capture to the pointerdown target (Pointer
    // Events spec); without releasing it, `pointerenter` never fires on
    // sibling cells on real touch hardware and the drag can't cross cells.
    // No-op for pointer types (mouse) that were never implicitly captured.
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onPointerEnter: DragPaintHandlers['onPointerEnter'] = (event, instrumentId, step, isOn) => {
    const latch = latches.current.get(event.pointerId)
    if (!latch) return
    if (!latch.applied) {
      // Deferred mode: crossing a cell boundary is what proves this is a paint
      // and not a swipe, so the origin cell is painted now, alongside this one.
      latch.applied = true
      applyMode(latch.mode, latch.origin.instrumentId, latch.origin.step, latch.origin.isOn)
    }
    applyMode(latch.mode, instrumentId, step, isOn)
    painted.current = true
  }

  const onClick: DragPaintHandlers['onClick'] = (event, instrumentId, step) => {
    // Keyboard-triggered clicks (Enter/Space on a focused button) carry
    // `detail: 0`; real pointer clicks carry `detail >= 1`. Both guards below
    // are scoped to pointer clicks, so the keyboard path always toggles — a
    // drag that ends over a different cell fires no cell `click` at all, so
    // `painted` can still be set when the next key press arrives.
    if (event.detail !== 0) {
      // The pointer already painted this drag, and wandered back to the cell
      // it started on: the trailing click must not undo it.
      if (painted.current) {
        painted.current = false
        return
      }
      // Pointer-down already toggled, so this click is the tap's echo.
      if (applyOnPointerDown) return
    }
    onToggleCell(instrumentId, step)
  }

  return { onPointerDown, onPointerEnter, onClick }
}
