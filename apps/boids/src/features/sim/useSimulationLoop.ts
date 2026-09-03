import { useEffect, useRef, type RefObject } from 'react'

import type { SimParams } from './engine/params.ts'
import { Simulation } from './engine/simulation.ts'
import { CanvasRenderer, type BoidShape } from './render/renderer.ts'
import type { Theme } from './themes.ts'

export interface UseSimulationLoopOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** The cursor overlay (field + glyph); positioned imperatively to the pointer. */
  overlayRef: RefObject<HTMLElement | null>
  theme: Theme
  shape: BoidShape
  params: SimParams
  /** False pauses the simulation: no `sim.step`, no rAF scheduled. */
  running: boolean
}

/** Read from outside React — see TEST_SEAM_KEY. */
export interface BoidsTestSeam {
  getPositions(): { x: number; y: number }[]
  /** The params the engine is actually running with, not just the UI readout. */
  getParams(): SimParams
  /** The pointer the cursor force is steering to, or null when off-canvas. */
  getPointer(): { x: number; y: number } | null
  /** Dropped beacons, with the strength frozen at placement. */
  getBeacons(): { x: number; y: number; strength: number }[]
}

/** A pointerdown→pointerup pair within this client-px distance is a tap
 * (drops/removes a beacon); anything longer is a drag steering the flock. */
const TAP_SLOP_PX = 8

/**
 * Test-only seam (mirrors backend-kit's window-key pattern): a property on
 * the canvas element itself, so Playwright CT can assert the simulation
 * advances between frames without reaching into canvas pixels. Always set —
 * inert in production since nothing reads it.
 */
export const TEST_SEAM_KEY = '__boidsTestSeam'

/**
 * Owns the engine/renderer lifecycle, the rAF loop, and canvas sizing
 * (ResizeObserver — world size is CSS pixels; the engine never touches the
 * DOM). React owns `theme`/`shape`/`params`; changes are pushed into the
 * engine/renderer imperatively, never by restarting the loop.
 *
 * The loop has two modes, switched by `applyRunState` (ADR 0043): animating
 * (the rAF loop runs) and static (one frame, no loop, repainted on demand via
 * `redrawIfStaticRef`). `running: false` and
 * `prefers-reduced-motion: reduce` both mean static.
 */
export function useSimulationLoop(opts: UseSimulationLoopOptions): void {
  const themeRef = useRef(opts.theme)
  const shapeRef = useRef(opts.shape)
  const paramsRef = useRef(opts.params)
  const runningRef = useRef(opts.running)
  const simRef = useRef<Simulation | null>(null)
  const redrawIfStaticRef = useRef<(() => void) | null>(null)
  const applyRunStateRef = useRef<(() => void) | null>(null)

  // Pausing/resuming must not re-run the loop effect below - that would rebuild
  // the Simulation and scatter the flock. The flag goes in via a ref instead.
  useEffect(() => {
    runningRef.current = opts.running
    applyRunStateRef.current?.()
  }, [opts.running])

  useEffect(() => {
    themeRef.current = opts.theme
    redrawIfStaticRef.current?.()
  }, [opts.theme])

  useEffect(() => {
    shapeRef.current = opts.shape
    redrawIfStaticRef.current?.()
  }, [opts.shape])

  useEffect(() => {
    paramsRef.current = opts.params
    simRef.current?.setParams(opts.params)
    redrawIfStaticRef.current?.()
  }, [opts.params])

  // canvasRef identity is stable across renders; theme/shape/params are
  // synced into the running loop by the effects above, not by re-running this one.
  useEffect(() => {
    const canvas = opts.canvasRef.current
    if (!canvas) return

    const renderer = new CanvasRenderer(canvas)
    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    const sim = new Simulation({
      width,
      height,
      params: paramsRef.current,
      rng: Math.random,
    })
    simRef.current = sim
    renderer.resize(width, height, window.devicePixelRatio || 1)

    ;(canvas as unknown as Record<string, BoidsTestSeam>)[TEST_SEAM_KEY] = {
      getPositions: () => sim.boids.map((b) => ({ x: b.x, y: b.y })),
      getParams: () => paramsRef.current,
      getPointer: () => sim.getPointer(),
      getBeacons: () => sim.beacons.map((b) => ({ ...b })),
    }

    // Pointer capture: one listener drives both the physics (via pointerRef,
    // read each frame) and the overlay position (imperatively, no re-render).
    // World coords are canvas-relative; the overlay is position:fixed so it
    // takes raw client coords — equal here only because the canvas is pinned to
    // the viewport origin.
    const pointerRef = { current: null as { x: number; y: number } | null }
    const onPointerMove = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect()
      pointerRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const el = opts.overlayRef.current
      if (el) {
        el.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`
        el.dataset.active = 'true'
      }
    }
    // Tap = beacon toggle. Down remembers where; up within TAP_SLOP_PX toggles
    // a beacon at that spot, frozen at the current cursor strength. A longer
    // gesture is a steering drag and never places one.
    let pendingTap: { x: number; y: number } | null = null
    const onPointerLeave = (): void => {
      pendingTap = null
      pointerRef.current = null
      const el = opts.overlayRef.current
      if (el) el.dataset.active = 'false'
    }

    const onPointerDown = (event: PointerEvent): void => {
      pendingTap = { x: event.clientX, y: event.clientY }
    }
    const onPointerCancel = (): void => {
      pendingTap = null
    }
    const onPointerUp = (event: PointerEvent): void => {
      const down = pendingTap
      pendingTap = null
      if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_SLOP_PX) return
      const rect = canvas.getBoundingClientRect()
      const result = sim.toggleBeaconAt(
        event.clientX - rect.left,
        event.clientY - rect.top,
        paramsRef.current.cursor,
      )
      if (result !== 'noop') redrawIfStaticRef.current?.()
    }
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)

    const draw = () => renderer.draw(sim, themeRef.current, shapeRef.current, paramsRef.current)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width: w, height: h } = entry.contentRect
      renderer.resize(w, h, window.devicePixelRatio || 1)
      sim.setBounds(w, h)
      redrawIfStaticRef.current?.()
    })
    resizeObserver.observe(canvas)

    let rafId = 0
    let lastTime = performance.now()
    function frame(time: number): void {
      const dt = time - lastTime
      lastTime = time
      sim.setPointer(pointerRef.current)
      sim.step(dt)
      draw()
      rafId = requestAnimationFrame(frame)
    }

    /** Paused and reduced-motion are the same thing to the loop: stay static. */
    const isAnimating = (): boolean => runningRef.current && !reducedMotion

    /**
     * The one animate/static switch, re-read whenever `running` changes. Static
     * mode leaves nothing scheduled and hands `draw` to `redrawIfStaticRef` so
     * settings changes still repaint the frame; animating mode owns the paint
     * and needs no on-demand repaint.
     */
    function applyRunState(): void {
      if (isAnimating()) {
        redrawIfStaticRef.current = null
        if (rafId) return
        // Restart the clock so the first dt after a resume is one frame, not
        // the whole paused interval.
        lastTime = performance.now()
        rafId = requestAnimationFrame(frame)
        return
      }
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
      redrawIfStaticRef.current = draw
      draw()
    }
    applyRunStateRef.current = applyRunState

    // A frame that opens static gets one step first, so it shows a stepped
    // flock rather than the raw spawn; the animating path steps per frame anyway.
    if (!isAnimating()) {
      sim.setPointer(pointerRef.current)
      sim.step(16)
    }
    applyRunState()

    return () => {
      resizeObserver.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      if (rafId) cancelAnimationFrame(rafId)
      redrawIfStaticRef.current = null
      applyRunStateRef.current = null
      simRef.current = null
    }
  }, [opts.canvasRef])
}
