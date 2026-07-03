import { useEffect, useRef, type RefObject } from 'react'

import type { SimParams } from './engine/params.ts'
import { Simulation } from './engine/simulation.ts'
import { CanvasRenderer, type BoidShape } from './render/renderer.ts'
import type { Theme } from './themes.ts'

export interface UseSimulationLoopOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  theme: Theme
  shape: BoidShape
  params: SimParams
}

/** Read from outside React — see TEST_SEAM_KEY. */
export interface BoidsTestSeam {
  getPositions(): { x: number; y: number }[]
  /** The params the engine is actually running with, not just the UI readout. */
  getParams(): SimParams
}

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
 * `prefers-reduced-motion: reduce` renders one static frame instead of
 * animating; settings changes still repaint that frame (tested in B5).
 */
export function useSimulationLoop(opts: UseSimulationLoopOptions): void {
  const themeRef = useRef(opts.theme)
  const shapeRef = useRef(opts.shape)
  const paramsRef = useRef(opts.params)
  const simRef = useRef<Simulation | null>(null)
  const redrawIfStaticRef = useRef<(() => void) | null>(null)

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
    }

    const draw = () => renderer.draw(sim, themeRef.current, shapeRef.current, paramsRef.current)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    redrawIfStaticRef.current = reducedMotion ? draw : null

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width: w, height: h } = entry.contentRect
      renderer.resize(w, h, window.devicePixelRatio || 1)
      sim.setBounds(w, h)
      if (reducedMotion) draw()
    })
    resizeObserver.observe(canvas)

    let rafId = 0
    let lastTime = performance.now()
    function frame(time: number): void {
      const dt = time - lastTime
      lastTime = time
      sim.step(dt)
      draw()
      rafId = requestAnimationFrame(frame)
    }

    if (reducedMotion) {
      sim.step(16)
      draw()
    } else {
      rafId = requestAnimationFrame(frame)
    }

    return () => {
      resizeObserver.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
      redrawIfStaticRef.current = null
      simRef.current = null
    }
  }, [opts.canvasRef])
}
