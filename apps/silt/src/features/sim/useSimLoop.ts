import { useEffect, useRef, type RefObject } from 'react'

import { FixedTimestep, MS_PER_TICK, Sim } from '../../sim/index.ts'
import { SimRenderer } from '../render/renderer.ts'

/**
 * Test-only seam (mirrors boids' window-key pattern): a property on the
 * canvas element itself, so Playwright CT can drive/observe the sim without
 * reaching into canvas pixels. Always set — inert in production since
 * nothing reads it.
 */
export const TEST_SEAM_KEY = '__siltTestSeam'

export interface SiltTestSeam {
  speciesAt(x: number, y: number): number
  /** How many cells currently hold this species — position-independent, for
   * asserting "painting worked" without racing the sim's own movement. */
  countSpecies(species: number): number
  gridToCanvasPoint(x: number, y: number): { x: number; y: number }
}

export interface UseSimLoopOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** Paused = setup mode (spec §3); painting works in both states. */
  running: boolean
  /** The species painting applies — Dirt or Sand for now (ticket 07 owns the real rail). */
  selectedElement: number
}

/**
 * Owns the Sim/renderer lifecycle for the page: the fixed-timestep tick loop
 * (decoupled from rAF per spec §5.3), DPR-aware canvas sizing (a
 * ResizeObserver for CSS-size changes plus a `resolution` media-query watcher
 * for zoom-only devicePixelRatio changes — both refit the canvas only, the
 * sim is never touched), and click/drag painting. React owns
 * `running`/`selectedElement`; changes are pushed into the loop via refs,
 * never by restarting the effect, so toggling play/pause never resets the
 * world.
 */
export function useSimLoop(opts: UseSimLoopOptions): void {
  const runningRef = useRef(opts.running)
  const selectedRef = useRef(opts.selectedElement)

  useEffect(() => {
    runningRef.current = opts.running
  }, [opts.running])

  useEffect(() => {
    selectedRef.current = opts.selectedElement
  }, [opts.selectedElement])

  // canvasRef identity is stable across renders; running/selectedElement are
  // synced into the running loop by the effects above, not by re-running this one.
  useEffect(() => {
    const canvas = opts.canvasRef.current
    if (!canvas) return

    const sim = new Sim()
    const renderer = new SimRenderer(canvas, sim.registry)

    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    renderer.resize(width, height, window.devicePixelRatio || 1)

    const refit = (): void => {
      const rect = canvas.getBoundingClientRect()
      renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1)
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width: w, height: h } = entry.contentRect
      renderer.resize(w, h, window.devicePixelRatio || 1)
    })
    resizeObserver.observe(canvas)

    // devicePixelRatio changes (browser/OS zoom) don't touch the canvas's CSS
    // size, so ResizeObserver never fires for them — spec §6 requires the
    // backing store to re-evaluate on zoom too. A `resolution` media query
    // fires once when the ratio changes; re-subscribing at the new ratio
    // keeps catching the next change.
    let stopWatchingDpr = (): void => {}
    const watchDpr = (): void => {
      const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
      const onDprChange = (): void => {
        refit()
        watchDpr()
      }
      query.addEventListener('change', onDprChange)
      stopWatchingDpr = () => query.removeEventListener('change', onDprChange)
    }
    watchDpr()

    let painting = false
    const paintAt = (clientX: number, clientY: number): void => {
      const rect = canvas.getBoundingClientRect()
      const cell = renderer.canvasPointToGrid(clientX - rect.left, clientY - rect.top)
      if (!cell) return
      sim.paint(cell.x, cell.y, selectedRef.current)
    }
    const onPointerDown = (event: PointerEvent): void => {
      painting = true
      paintAt(event.clientX, event.clientY)
    }
    const onPointerMove = (event: PointerEvent): void => {
      if (!painting) return
      paintAt(event.clientX, event.clientY)
    }
    const stopPainting = (): void => {
      painting = false
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', stopPainting)
    canvas.addEventListener('pointerleave', stopPainting)

    const timestep = new FixedTimestep(MS_PER_TICK)

    ;(canvas as unknown as Record<string, SiltTestSeam>)[TEST_SEAM_KEY] = {
      speciesAt: (x, y) => sim.speciesAt(x, y),
      countSpecies: (species) => {
        let count = 0
        for (let y = 0; y < sim.height; y++) {
          for (let x = 0; x < sim.width; x++) {
            if (sim.speciesAt(x, y) === species) count++
          }
        }
        return count
      },
      gridToCanvasPoint: (x, y) => renderer.gridToCanvasPoint(x, y),
    }

    let rafId = 0
    let lastTime = performance.now()
    function frame(time: number): void {
      const dt = time - lastTime
      lastTime = time
      if (runningRef.current) timestep.advance(dt, () => sim.tick())
      renderer.draw(sim)
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)

    return () => {
      resizeObserver.disconnect()
      stopWatchingDpr()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', stopPainting)
      canvas.removeEventListener('pointerleave', stopPainting)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [opts.canvasRef])
}
