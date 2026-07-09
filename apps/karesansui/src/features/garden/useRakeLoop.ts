import { useCallback, useEffect, useRef, type RefObject } from 'react'

import { geom } from './engine/geom.ts'
import type { Geom } from './engine/geom.ts'
import type { GardenConfig } from './engine/state.ts'
import { MechRenderer } from './render/MechRenderer.ts'
import { SandRenderer } from './render/SandRenderer.ts'

export interface UseRakeLoopOptions {
  sandRef: RefObject<HTMLCanvasElement | null>
  mechRef: RefObject<HTMLCanvasElement | null>
  config: GardenConfig
  /** Run/Pause button state from the page. */
  running: boolean
  /** Called when a carve finishes so the page flips `running` back to false. */
  onCarveComplete: () => void
}

/** Test-only seam key on the sand canvas (mirrors boids' `TEST_SEAM_KEY`). */
export const RAKE_TEST_SEAM_KEY = '__karesansuiTestSeam'

/** Read from outside React — see RAKE_TEST_SEAM_KEY. */
export interface RakeTestSeam {
  /** Carve progress 0..1, for the `.iwft` to assert the carve advances. */
  getProgress(): number
  getConfig(): GardenConfig
  /** True once a carve has run to completion. */
  isCarved(): boolean
}

/**
 * Owns the rAF loop and both canvases. Instantiates a `SandRenderer` +
 * `MechRenderer` in one canvas-keyed effect; React pushes `config`/`running`
 * changes in imperatively via refs (never by restarting the loop), exactly like
 * boids' `useSimulationLoop`.
 *
 * All geometry and drawing is delegated to the engine (`geom`) and the
 * renderers — the hook owns lifecycle, timing, and the carve/pause/smooth state
 * machine only.
 *
 * Follows the reference's parity: no `prefers-reduced-motion` handling — the
 * mock has none, and the carve/smooth animations are the whole point.
 */
export function useRakeLoop(opts: UseRakeLoopOptions): {
  smooth(): void
  exportPNG(): void
} {
  const configRef = useRef<GardenConfig>(opts.config)
  const runningRef = useRef<boolean>(opts.running)
  const onCompleteRef = useRef<() => void>(opts.onCarveComplete)

  // Closures wired up inside the canvas effect; null before the renderers exist.
  const applyRunningRef = useRef<((running: boolean) => void) | null>(null)
  const applyConfigRef = useRef<((config: GardenConfig) => void) | null>(null)
  const smoothRef = useRef<(() => void) | null>(null)
  const exportRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    onCompleteRef.current = opts.onCarveComplete
  }, [opts.onCarveComplete])

  useEffect(() => {
    runningRef.current = opts.running
    applyRunningRef.current?.(opts.running)
  }, [opts.running])

  useEffect(() => {
    // applyConfig updates configRef and decides invalidate vs. speed-only.
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
    let currentGeom: Geom | null = null
    // Carve in progress (begun, not yet complete): non-null while running or
    // paused, null when idle or completed. Holds the elapsed time for resume.
    let carve: { geom: Geom; duration: number; elapsed: number; lastTs: number } | null = null
    let progress = 0
    let carved = false
    let smoothing = false
    let rafId = 0

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
      if (!currentGeom) return
      const config = configRef.current
      sand.renderStatic(currentGeom, config.showPreview)
      mech.draw(config, 0)
      progress = 0
    }

    // Reproduce a completed pattern in one pass — no animation (D6 resize).
    const drawCarvedFinal = (): void => {
      if (!currentGeom) return
      const config = configRef.current
      sand.beginCarve(currentGeom, config.rake)
      sand.carveTo(1)
      sand.finishCarve()
      mech.draw(config, currentGeom.tMax)
      progress = 1
    }

    // Repaint whatever the bed currently shows, without re-animating.
    const redrawCurrent = (): void => {
      if (carved) drawCarvedFinal()
      else drawStatic()
    }

    const rebuild = (size: number): void => {
      boardR = size * 0.46
      sand.resize(size, dpr())
      mech.resize(size, dpr())
      currentGeom = geom(configRef.current, boardR)
    }

    const carveFrame = (ts: number): void => {
      if (!carve || !currentGeom) return
      carve.elapsed += ts - carve.lastTs
      carve.lastTs = ts
      progress = Math.min(1, carve.elapsed / carve.duration)
      sand.carveTo(progress)
      mech.draw(configRef.current, carve.geom.tMax * progress)
      if (progress < 1) {
        rafId = requestAnimationFrame(carveFrame)
      } else {
        sand.finishCarve()
        rafId = 0
        carve = null
        carved = true
        onCompleteRef.current()
      }
    }

    const startCarve = (): void => {
      if (!currentGeom) return
      stopRaf()
      const config = configRef.current
      sand.beginCarve(currentGeom, config.rake)
      carved = false
      progress = 0
      // brisk ≈ 1.5s → meditative ≈ 31s (reference startRake curve).
      carve = {
        geom: currentGeom,
        duration: 1500 + Math.pow((100 - config.speed) / 100, 1.7) * 30000,
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

    // Cancel the loop but keep `carve` (held elapsed) for a later resume.
    const pauseCarve = (): void => {
      stopRaf()
    }

    // Cancel and discard the carve, popping the ctx save/clip beginCarve pushed.
    const abortCarve = (): void => {
      stopRaf()
      if (carve) {
        sand.finishCarve()
        carve = null
      }
    }

    applyRunningRef.current = (running: boolean): void => {
      if (smoothing) return // Run is inert while a smoothing sweep is playing
      if (running) {
        if (carve) resumeCarve()
        else startCarve()
      } else if (carve) {
        pauseCarve()
      }
    }

    applyConfigRef.current = (next: GardenConfig): void => {
      const prev = configRef.current
      configRef.current = next
      const patternChanged =
        prev.ring !== next.ring ||
        prev.offset !== next.offset ||
        prev.turns !== next.turns ||
        prev.rake !== next.rake ||
        prev.wheels.length !== next.wheels.length ||
        prev.wheels.some((w, i) => w !== next.wheels[i])
      if (patternChanged) {
        abortCarve()
        smoothing = false
        carved = false
        boardR = cssSize() * 0.46
        currentGeom = geom(next, boardR)
        drawStatic()
        return
      }
      // showPreview only affects the faint guide line drawn under the
      // static/carved bed — never carveTo's drawing — so a running/paused
      // carve is left untouched. Idle/carved beds get repainted to reflect it.
      // Speed-only changes fall through here too: nothing to redraw.
      if (prev.showPreview !== next.showPreview && !carve) {
        redrawCurrent()
      }
    }

    smoothRef.current = (): void => {
      if (smoothing) return
      abortCarve()
      carved = false
      smoothing = true
      const dur = 1550
      const start = performance.now()
      const step = (now: number): void => {
        const p = Math.min(1, (now - start) / dur)
        sand.smoothStep(p)
        if (p < 1) {
          rafId = requestAnimationFrame(step)
        } else {
          rafId = 0
          smoothing = false
        }
      }
      rafId = requestAnimationFrame(step)
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
    }
    ;(sandCanvas as unknown as Record<string, RakeTestSeam>)[RAKE_TEST_SEAM_KEY] = seam

    const resizeObserver = new ResizeObserver((entries) => {
      const size = entries[0]?.contentRect.width
      if (!size) return
      // A resize mid-carve would tear the clipped bed; abort and repaint the
      // current state statically — resize never re-animates (D6).
      if (carve) {
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
      smoothRef.current = null
      exportRef.current = null
      delete (sandCanvas as unknown as Record<string, RakeTestSeam>)[RAKE_TEST_SEAM_KEY]
    }
  }, [opts.sandRef, opts.mechRef])

  const smooth = useCallback((): void => smoothRef.current?.(), [])
  const exportPNG = useCallback((): void => exportRef.current?.(), [])
  return { smooth, exportPNG }
}
