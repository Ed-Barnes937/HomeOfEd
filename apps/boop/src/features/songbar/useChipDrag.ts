import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'

/**
 * A ~8px movement threshold separates a drag from a tap-to-select —
 * PhoneGrid's tap-vs-drag rule, applied to the chips (spec §8).
 */
const DRAG_THRESHOLD_PX = 8

/** The handoff's lane pitch (46px lane + 8px gap) — only a fallback; the real pitch is measured. */
const FALLBACK_ROW_PITCH_PX = 54

/** A live chip drag: where it started, where it would drop, and how far the pointer is. */
export interface ChipDragState {
  from: number
  to: number
  /** The pointer's vertical travel — the dragged lane follows it exactly. */
  dy: number
  /** The measured lane pitch — how far the other lanes step aside. */
  rowPitch: number
}

export interface ChipDragHandlers {
  drag: ChipDragState | null
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, index: number) => void
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onClick: (index: number) => void
}

interface ChipDragOptions {
  laneCount: number
  /** The lane-rows container — measured for the real lane pitch at drag start. */
  containerRef: RefObject<HTMLDivElement | null>
  /** Drop commits: move the lane at `from` to `to`. */
  onMove: (from: number, to: number) => void
  /** A sub-threshold press is a tap: select the clip. */
  onTap: (index: number) => void
}

/**
 * Whole-chip vertical drag-to-reorder (boop-loops ticket 18, spec §8). The
 * chip is its own handle — no new chrome. Pointer capture keeps the moves
 * coming while the pointer roams; the drop target is simply how many lane
 * pitches the pointer has travelled, clamped to the lanes. Rendering the
 * make-way is the caller's job, off the returned `drag` state.
 */
export function useChipDrag({
  laneCount,
  containerRef,
  onMove,
  onTap,
}: ChipDragOptions): ChipDragHandlers {
  const [drag, setDrag] = useState<ChipDragState | null>(null)
  const tracking = useRef<{
    pointerId: number
    from: number
    startY: number
    rowPitch: number
    /** Set once the travel crosses the threshold — the press is a drag now. */
    active: boolean
  } | null>(null)
  // Set when a drag just committed, so the trailing `click` on the chip must
  // not also select it. Reset on the next press.
  const suppressTap = useRef(false)

  function measureRowPitch(): number {
    const rows = containerRef.current?.children
    if (!rows || rows.length < 2) return FALLBACK_ROW_PITCH_PX
    return rows[1]!.getBoundingClientRect().top - rows[0]!.getBoundingClientRect().top
  }

  /** How many lane pitches the pointer has travelled, clamped to the lanes. */
  function targetLane(from: number, startY: number, rowPitch: number, clientY: number): number {
    return Math.min(laneCount - 1, Math.max(0, from + Math.round((clientY - startY) / rowPitch)))
  }

  const onPointerDown: ChipDragHandlers['onPointerDown'] = (event, index) => {
    suppressTap.current = false
    tracking.current = {
      pointerId: event.pointerId,
      from: index,
      startY: event.clientY,
      rowPitch: measureRowPitch(),
      active: false,
    }
    // Capture so the chip keeps receiving moves once the pointer leaves it.
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove: ChipDragHandlers['onPointerMove'] = (event) => {
    const t = tracking.current
    if (!t || event.pointerId !== t.pointerId) return
    const dy = event.clientY - t.startY
    if (!t.active) {
      if (Math.abs(dy) < DRAG_THRESHOLD_PX) return
      t.active = true
    }
    const to = targetLane(t.from, t.startY, t.rowPitch, event.clientY)
    setDrag({ from: t.from, to, dy, rowPitch: t.rowPitch })
  }

  const onPointerUp: ChipDragHandlers['onPointerUp'] = (event) => {
    const t = tracking.current
    if (!t || event.pointerId !== t.pointerId) return
    tracking.current = null
    if (!t.active) return
    suppressTap.current = true
    setDrag(null)
    // Commit and clear land in the same update, so the lanes re-render once —
    // reordered, transforms gone, nothing to transition.
    const to = targetLane(t.from, t.startY, t.rowPitch, event.clientY)
    if (to !== t.from) onMove(t.from, to)
  }

  /** The browser claimed the gesture — abandon the drag, commit nothing. */
  const onPointerCancel: ChipDragHandlers['onPointerCancel'] = (event) => {
    const t = tracking.current
    if (!t || event.pointerId !== t.pointerId) return
    tracking.current = null
    setDrag(null)
  }

  const onClick: ChipDragHandlers['onClick'] = (index) => {
    if (suppressTap.current) {
      suppressTap.current = false
      return
    }
    onTap(index)
  }

  return { drag, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick }
}
