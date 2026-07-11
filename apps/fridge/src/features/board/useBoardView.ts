import { type PointerEvent as ReactPointerEvent, useCallback, useLayoutEffect, useRef, useState } from 'react'

import { clampPan, computeFitScale, MAX_ZOOM, MIN_ZOOM } from './canvas.ts'

/**
 * Owns the board's *view* transform (ADR 0022 — "Editing on mobile"): the
 * scale-to-fit that letterboxes the fixed logical door into the stage, plus a
 * view-only pinch-zoom / drag-pan on top. Pure presentation — it never touches
 * the stored coordinate space; the fit + zoom are a single CSS transform on the
 * door, and `useFridgeBoard` reads the resulting scale back off the surface
 * rect, so magnets keep tracking the finger at any zoom.
 *
 * Gestures are attached to the stage. Magnet pointer-downs `stopPropagation`,
 * so they never reach here — a single finger pans only when zoomed in (so the
 * default fit view behaves exactly as before on desktop), two fingers pinch.
 */
export interface BoardView {
  stageRef: React.RefObject<HTMLDivElement | null>
  /** The transform for the door scaler: `scale(fit·zoom) translate(pan)`. */
  transform: string
  showReset: boolean
  reset: () => void
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void
}

interface Pt {
  x: number
  y: number
}

const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function useBoardView(): BoardView {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [stage, setStage] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Pt>({ x: 0, y: 0 })

  // Refs mirror the latest values so the stable handlers read fresh state.
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const panRef = useRef(pan)
  panRef.current = pan
  const stageRef2 = useRef(stage)
  stageRef2.current = stage

  const fit = computeFitScale(stage.w, stage.h)

  // Measure the stage's content box; drives only the fit scale, not coords.
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setStage({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Active pointers + gesture snapshots (transient — refs, not state).
  const pointers = useRef(new Map<number, Pt>())
  const panning = useRef<{ id: number; last: Pt } | null>(null)
  const pinch = useRef<{ d0: number; m0: Pt; s0: number; zoom0: number; pan0: Pt; centre: Pt } | null>(null)

  const stageCentre = useCallback((): Pt => {
    const r = stageRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, [])

  const startPinch = useCallback(() => {
    const pts = [...pointers.current.values()]
    if (pts.length < 2) return
    panning.current = null
    pinch.current = {
      d0: dist(pts[0]!, pts[1]!),
      m0: mid(pts[0]!, pts[1]!),
      s0: fit * zoomRef.current,
      zoom0: zoomRef.current,
      pan0: panRef.current,
      centre: stageCentre(),
    }
  }, [fit, stageCentre])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size === 2) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        startPinch()
      } else if (pointers.current.size === 1 && zoomRef.current > 1) {
        // Single-finger pan only when zoomed in — the fit view has no room to
        // pan and this keeps desktop tap/deselect behaviour unchanged.
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        panning.current = { id: e.pointerId, last: { x: e.clientX, y: e.clientY } }
      }
    },
    [startPinch],
  )

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const stageNow = stageRef2.current
    const fitNow = computeFitScale(stageNow.w, stageNow.h)

    const pin = pinch.current
    if (pin && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()]
      const d1 = dist(pts[0]!, pts[1]!)
      const m1 = mid(pts[0]!, pts[1]!)
      const zoom1 = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pin.zoom0 * (d1 / pin.d0)))
      const s1 = fitNow * zoom1
      // Keep the logical point under the initial pinch midpoint fixed under the
      // fingers as they zoom + move (screen = centre + s·(logical − c + pan)).
      const next = {
        x: (m1.x - pin.centre.x) / s1 + pin.pan0.x - (pin.m0.x - pin.centre.x) / pin.s0,
        y: (m1.y - pin.centre.y) / s1 + pin.pan0.y - (pin.m0.y - pin.centre.y) / pin.s0,
      }
      setZoom(zoom1)
      setPan(clampPan(next, s1, stageNow.w, stageNow.h))
      return
    }

    const p = panning.current
    if (p && p.id === e.pointerId) {
      const s = fitNow * zoomRef.current
      const dx = (e.clientX - p.last.x) / s
      const dy = (e.clientY - p.last.y) / s
      p.last = { x: e.clientX, y: e.clientY }
      setPan((prev) => clampPan({ x: prev.x + dx, y: prev.y + dy }, s, stageNow.w, stageNow.h))
    }
  }, [])

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (panning.current?.id === e.pointerId) panning.current = null
    if (pointers.current.size < 2) pinch.current = null
    // A finger lifting from a pinch can leave one down — promote to pan.
    if (pointers.current.size === 1 && zoomRef.current > 1) {
      const [id, pt] = [...pointers.current.entries()][0]!
      panning.current = { id, last: pt }
    }
  }, [])

  const reset = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const transform = `scale(${fit * zoom}) translate(${pan.x}px, ${pan.y}px)`
  const showReset = zoom !== 1 || pan.x !== 0 || pan.y !== 0

  return { stageRef, transform, showReset, reset, onPointerDown, onPointerMove, onPointerUp }
}
