import { useCallback, useEffect, useRef, type RefObject } from 'react'

import { gardenCurves, type Garden } from './engine/garden.ts'
import type { GardenConfig } from './engine/state.ts'
import { MechRenderer } from './render/MechRenderer.ts'
import { SandRenderer } from './render/SandRenderer.ts'

export interface UseRakeLoopOptions {
  sandRef: RefObject<HTMLCanvasElement | null>
  mechRef: RefObject<HTMLCanvasElement | null>
  config: GardenConfig
  /** Play/Pause button state from the page. */
  running: boolean
  /** Called when a (non-perpetual) draw finishes so the page flips `running` back. */
  onCarveComplete: () => void
}

/** Test-only seam key on the sand canvas (mirrors boids' `TEST_SEAM_KEY`). */
export const RAKE_TEST_SEAM_KEY = '__karesansuiTestSeam'

/** Read from outside React — see RAKE_TEST_SEAM_KEY. */
export interface RakeTestSeam {
  /** Draw progress 0..1, for the `.iwft` to assert the carve advances. */
  getProgress(): number
  getConfig(): GardenConfig
  /** True once a draw has run to completion (and is holding). */
  isCarved(): boolean
  /** Each cog's last-drawn marble point — asserts per-cog coupling (plan 0008). */
  getMarblePens(): [number, number][]
}

/** Clearing-rake sweep duration (ms) — one comb pass over the bed. */
const CLEAR_DUR = 1800

/**
 * Owns the rAF loop and both canvases. Instantiates a `SandRenderer` +
 * `MechRenderer` in one canvas-keyed effect; React pushes `config`/`running`
 * changes in imperatively via refs (never by restarting the loop), like boids'
 * `useSimulationLoop`.
 *
 * The "many pens" state machine (plan 0008): **Play** draws all cogs' grooves;
 * with the **clearing rake off** it holds the finished pattern; with it **on**
 * it runs a perpetual draw → sweep-clear → redraw loop. **Clear** runs one
 * clearing pass. Under `prefers-reduced-motion` the draw lands complete, the
 * clear flattens instantly, and there is no perpetual loop.
 */
export function useRakeLoop(opts: UseRakeLoopOptions): {
  clear(): void
  exportPNG(): void
} {
  const configRef = useRef<GardenConfig>(opts.config)
  const runningRef = useRef<boolean>(opts.running)
  const onCompleteRef = useRef<() => void>(opts.onCarveComplete)

  // Closures wired up inside the canvas effect; null before the renderers exist.
  const applyRunningRef = useRef<((running: boolean) => void) | null>(null)
  const applyConfigRef = useRef<((config: GardenConfig) => void) | null>(null)
  const clearRef = useRef<(() => void) | null>(null)
  const exportRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    onCompleteRef.current = opts.onCarveComplete
  }, [opts.onCarveComplete])

  useEffect(() => {
    runningRef.current = opts.running
    applyRunningRef.current?.(opts.running)
  }, [opts.running])

  useEffect(() => {
    applyConfigRef.current?.(opts.config)
  }, [opts.config])

  // canvasRef identities are stable; config/running are synced into the loop by
  // the effects above, so this effect never re-runs for a prop change.
  useEffect(() => {
    const sandCanvas = opts.sandRef.current
    const mechCanvas = opts.mechRef.current
    if (!sandCanvas || !mechCanvas) return

    const sand = new SandRenderer(sandCanvas)
    const mech = new MechRenderer(mechCanvas)

    // --- machine state (effect-local; the seam and closures read these) ---
    let boardR = 0
    let currentGarden: Garden | null = null
    // A draw in progress: non-null while running or paused, null when idle/done.
    let carve: { duration: number; elapsed: number; lastTs: number } | null = null
    // A clearing sweep in progress. `loop` distinguishes the perpetual clear
    // (redraws after) from a one-off manual Clear.
    let clear: { duration: number; elapsed: number; lastTs: number; loop: boolean } | null = null
    let progress = 0
    let carved = false
    let rafId = 0

    const reducedMotion = (): boolean =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    const dpr = (): number => Math.min(window.devicePixelRatio || 1, 2)
    const cssSize = (): number =>
      sandCanvas.clientWidth || sandCanvas.getBoundingClientRect().width || 0

    const stopRaf = (): void => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    }

    const drawStatic = (): void => {
      if (!currentGarden) return
      sand.renderStatic(currentGarden, configRef.current.showPreview)
      mech.draw(0)
      progress = 0
    }

    // Reproduce a completed pattern in one pass — no animation (D6 resize).
    const drawCarvedFinal = (): void => {
      if (!currentGarden) return
      sand.beginCarve(currentGarden)
      sand.carveTo(1)
      sand.finishCarve()
      mech.draw(1)
      progress = 1
      carved = true
    }

    const redrawCurrent = (): void => {
      if (carved) drawCarvedFinal()
      else drawStatic()
    }

    const rebuild = (size: number): void => {
      boardR = size * 0.46
      sand.resize(size, dpr())
      mech.setPattern(configRef.current)
      mech.resize(size, dpr())
      currentGarden = gardenCurves(configRef.current, boardR)
    }

    // ---- draw phase ----

    const carveFrame = (ts: number): void => {
      if (!carve || !currentGarden) return
      carve.elapsed += ts - carve.lastTs
      carve.lastTs = ts
      progress = Math.min(1, carve.elapsed / carve.duration)
      sand.carveTo(progress)
      mech.draw(progress)
      if (progress < 1) {
        rafId = requestAnimationFrame(carveFrame)
        return
      }
      sand.finishCarve()
      rafId = 0
      carve = null
      carved = true
      // Clearing rake on ⇒ sweep the bed and draw again, forever.
      if (configRef.current.clearingRake && runningRef.current) {
        beginClear(true)
      } else {
        onCompleteRef.current()
      }
    }

    const startCarve = (): void => {
      if (!currentGarden) return
      stopRaf()
      sand.beginCarve(currentGarden)
      carved = false
      progress = 0
      // Reduced motion: land the finished pattern at once, no perpetual loop.
      if (reducedMotion()) {
        sand.carveTo(1)
        sand.finishCarve()
        mech.draw(1)
        progress = 1
        carved = true
        onCompleteRef.current()
        return
      }
      // brisk ≈ 1.5s → meditative ≈ 31s (reference startRake curve).
      carve = {
        duration: 1500 + Math.pow((100 - configRef.current.speed) / 100, 1.7) * 30000,
        elapsed: 0,
        lastTs: performance.now(),
      }
      rafId = requestAnimationFrame(carveFrame)
    }

    const resumeCarve = (): void => {
      if (!carve) return
      carve.lastTs = performance.now()
      rafId = requestAnimationFrame(carveFrame)
    }

    // ---- clear phase ----

    function clearFrame(ts: number): void {
      if (!clear) return
      clear.elapsed += ts - clear.lastTs
      clear.lastTs = ts
      const sweep = Math.min(1, clear.elapsed / clear.duration)
      sand.clearTo(sweep)
      mech.draw(1)
      if (sweep < 1) {
        rafId = requestAnimationFrame(clearFrame)
        return
      }
      rafId = 0
      const loop = clear.loop
      clear = null
      carved = false
      if (loop && runningRef.current) {
        startCarve()
      } else {
        drawStatic()
      }
    }

    function beginClear(loop: boolean): void {
      stopRaf()
      if (reducedMotion()) {
        sand.clearTo(1)
        carved = false
        clear = null
        if (loop && runningRef.current) startCarve()
        else drawStatic()
        return
      }
      clear = { duration: CLEAR_DUR, elapsed: 0, lastTs: performance.now(), loop }
      rafId = requestAnimationFrame(clearFrame)
    }

    const resumeClear = (): void => {
      if (!clear) return
      clear.lastTs = performance.now()
      rafId = requestAnimationFrame(clearFrame)
    }

    // Cancel and discard any in-flight draw/clear.
    const abortCarve = (): void => {
      stopRaf()
      if (carve) {
        sand.finishCarve()
        carve = null
      }
      clear = null
    }

    applyRunningRef.current = (running: boolean): void => {
      if (running) {
        if (clear) resumeClear()
        else if (carve) resumeCarve()
        else startCarve()
      } else {
        stopRaf() // keep carve/clear for a later resume
      }
    }

    applyConfigRef.current = (next: GardenConfig): void => {
      const prev = configRef.current
      configRef.current = next
      const patternChanged =
        prev.ring !== next.ring ||
        prev.offset !== next.offset ||
        prev.wheels.length !== next.wheels.length ||
        prev.wheels.some((w, i) => w !== next.wheels[i])
      if (patternChanged) {
        abortCarve()
        carved = false
        boardR = cssSize() * 0.46
        currentGarden = gardenCurves(next, boardR)
        mech.setPattern(next)
        drawStatic()
        return
      }
      // showPreview only affects the faint guide line — repaint idle/carved beds.
      // Speed / clearingRake changes are read at the next phase boundary.
      if (prev.showPreview !== next.showPreview && !carve && !clear) {
        redrawCurrent()
      }
    }

    clearRef.current = (): void => {
      if (clear) return
      abortCarve()
      beginClear(false)
    }

    exportRef.current = (): void => {
      const a = document.createElement('a')
      a.href = sand.toDataURL()
      a.download = 'karesansui.png'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }

    // Initial sizing + paint.
    rebuild(cssSize())
    redrawCurrent()

    const seam: RakeTestSeam = {
      getProgress: () => progress,
      getConfig: () => configRef.current,
      isCarved: () => carved,
      getMarblePens: () => mech.getMarbles(),
    }
    ;(sandCanvas as unknown as Record<string, RakeTestSeam>)[RAKE_TEST_SEAM_KEY] = seam

    const resizeObserver = new ResizeObserver((entries) => {
      const size = entries[0]?.contentRect.width
      if (!size) return
      // A resize mid-draw would tear the bed; abort and repaint statically (D6).
      if (carve || clear) {
        abortCarve()
        carved = false
      }
      rebuild(size)
      redrawCurrent()
    })
    resizeObserver.observe(sandCanvas)

    // Apply the running state that was set before the renderers existed.
    applyRunningRef.current(runningRef.current)

    return () => {
      resizeObserver.disconnect()
      stopRaf()
      applyRunningRef.current = null
      applyConfigRef.current = null
      clearRef.current = null
      exportRef.current = null
      delete (sandCanvas as unknown as Record<string, RakeTestSeam>)[RAKE_TEST_SEAM_KEY]
    }
  }, [opts.sandRef, opts.mechRef])

  const clear = useCallback((): void => clearRef.current?.(), [])
  const exportPNG = useCallback((): void => exportRef.current?.(), [])
  return { clear, exportPNG }
}
