import { useEffect, useRef, useState, type RefObject } from 'react'

import {
  createRegistry,
  FixedTimestep,
  GRID_WIDTH,
  MS_PER_TICK,
  Sim,
  v1Elements,
  v1Reactions,
  type ElementRegistry,
} from '../../sim/index.ts'
import { SimRenderer } from '../render/renderer.ts'
import { decodeScene, encodeScene } from '../scenes/sceneCodec.ts'
import { emitSpawners, type Spawner } from '../spawners/spawners.ts'

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

/** Where the pointer is, in both grid and CSS-px terms — enough to draw a
 * brush outline over the canvas without the caller touching sim/renderer internals. */
export interface CursorInfo {
  cell: { x: number; y: number }
  /** CSS-px centre of `cell` on the on-screen canvas. */
  point: { x: number; y: number }
  /** CSS px per cell — the fit is aspect-preserving, so one value covers both axes. */
  cellSize: number
}

/** Paint applies the selected element/brush; spawner places or removes a
 * continuous emitter under the click (spec §7). */
export type SimMode = 'paint' | 'spawner'

export interface UseSimLoopOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** Paused = setup mode (spec §3); painting works in both states. */
  running: boolean
  /** The species painting or spawner placement applies — EMPTY when the erase tool is active. */
  selectedElement: number
  /** Square brush width in cells (odd, so it has a centre); 1 = single cell. Spawners ignore this — one entity per click. */
  brushWidth: number
  /** Paint vs spawner-placement mode (spec §3, §7); the rail toggle from ticket 07. */
  mode: SimMode
  /** Fires on every paint — the caller derives "first stroke" (spec §9 hint) from it. */
  onPaint?: () => void
  /** Fires as the pointer moves over the canvas, `null` once it leaves. */
  onCursorChange?: (info: CursorInfo | null) => void
  /** Fires roughly 4x/second with the render loop's smoothed FPS (spec §9 status bar). */
  onFps?: (fps: number) => void
  /** Fires whenever a spawner is placed or removed, with the current list (a fresh copy). */
  onSpawnersChange?: (spawners: readonly Spawner[]) => void
}

/** `(dx, dy)` offsets covering a centred square brush of this cell width (odd, so it has a centre). */
function brushOffsets(width: number): readonly { dx: number; dy: number }[] {
  const half = (width - 1) / 2
  const lo = Math.floor(half)
  const hi = Math.ceil(half)
  const offsets: { dx: number; dy: number }[] = []
  for (let dy = -lo; dy <= hi; dy++) {
    for (let dx = -lo; dx <= hi; dx++) {
      offsets.push({ dx, dy })
    }
  }
  return offsets
}

export interface UseSimLoopControls {
  /** The registry the running sim renders from — the rail derives its
   * colours from this (never `v1Elements` directly), so it can't drift from
   * the canvas (ticket 16). Defaults to the same v1 registry `Sim` builds by
   * default, until the mount effect below swaps in the sim's own instance. */
  registry: ElementRegistry
  /** Advance exactly one sim tick — spec §3's step, meant for while paused. */
  step: () => void
  /** Back to a freshly constructed world, cells and spawners alike (spec §3, §7). */
  reset: () => void
  /** Grid cell → CSS-px point on the on-screen canvas (cell centre), for drawing spawner chrome over the world. `null` before the canvas has a fit. */
  gridToCanvasPoint: (x: number, y: number) => { x: number; y: number } | null
  /** CSS px per cell, matching `CursorInfo.cellSize` — for sizing spawner chrome. */
  cellSize: () => number
  /** The world and its spawners as a scene envelope, plus a thumbnail of the last drawn frame. */
  saveScene: () => { json: string; thumbnail: string | null }
  /**
   * Replace the world (and its spawners) with a saved scene. Throws
   * `SceneLoadError` if the scene cannot be applied; otherwise returns the
   * non-fatal warnings the load collected. The caller is responsible for
   * entering paused — the loop never changes `running` behind React's back.
   */
  loadScene: (json: string) => string[]
}

/**
 * Owns the Sim/renderer lifecycle for the page: the fixed-timestep tick loop
 * (decoupled from rAF per spec §5.3), DPR-aware canvas sizing (a
 * ResizeObserver for CSS-size changes plus a `resolution` media-query watcher
 * for zoom-only devicePixelRatio changes — both refit the canvas only, the
 * sim is never touched), and click/drag painting. React owns
 * `running`/`selectedElement`/`brushWidth`; changes are pushed into the loop
 * via refs, never by restarting the effect, so toggling play/pause never
 * resets the world. `step`/`reset` are exposed so the page's header buttons
 * can reach into the same sim instance.
 */
export function useSimLoop(opts: UseSimLoopOptions): UseSimLoopControls {
  const runningRef = useRef(opts.running)
  const selectedRef = useRef(opts.selectedElement)
  const brushRef = useRef(opts.brushWidth)
  const modeRef = useRef(opts.mode)
  const onPaintRef = useRef(opts.onPaint)
  const onCursorChangeRef = useRef(opts.onCursorChange)
  const onFpsRef = useRef(opts.onFps)
  const onSpawnersChangeRef = useRef(opts.onSpawnersChange)
  const simRef = useRef<Sim | null>(null)
  const rendererRef = useRef<SimRenderer | null>(null)
  const spawnersRef = useRef<Spawner[]>([])
  // Same defaults `Sim` itself falls back to, so the rail matches the canvas
  // from first paint — swapped for the sim's own `registry` once it mounts.
  const [registry, setRegistry] = useState<ElementRegistry>(() => createRegistry(v1Elements, v1Reactions))

  // One effect syncing all the latest-value refs (ticket 15), rather than one
  // per option — still an effect, not a render-phase write, so it doesn't
  // misbehave under concurrent rendering and StrictMode double-invocation.
  useEffect(() => {
    runningRef.current = opts.running
    selectedRef.current = opts.selectedElement
    brushRef.current = opts.brushWidth
    modeRef.current = opts.mode
    onPaintRef.current = opts.onPaint
    onCursorChangeRef.current = opts.onCursorChange
    onFpsRef.current = opts.onFps
    onSpawnersChangeRef.current = opts.onSpawnersChange
  })

  // canvasRef identity is stable across renders; the options above are synced
  // into the running loop by the effect above, not by re-running this one.
  useEffect(() => {
    const canvas = opts.canvasRef.current
    if (!canvas) return

    const sim = new Sim()
    simRef.current = sim
    setRegistry(sim.registry)
    const renderer = new SimRenderer(canvas, sim.registry)
    rendererRef.current = renderer

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

    const cellAt = (clientX: number, clientY: number): { x: number; y: number } | null => {
      const rect = canvas.getBoundingClientRect()
      return renderer.canvasPointToGrid(clientX - rect.left, clientY - rect.top)
    }

    let painting = false
    const paintAt = (clientX: number, clientY: number): void => {
      const cell = cellAt(clientX, clientY)
      if (!cell) return
      for (const { dx, dy } of brushOffsets(brushRef.current)) {
        const x = cell.x + dx
        const y = cell.y + dy
        if (x < 0 || y < 0 || x >= sim.width || y >= sim.height) continue
        sim.paint(x, y, selectedRef.current)
      }
      onPaintRef.current?.()
    }

    const notifySpawners = (): void => {
      onSpawnersChangeRef.current?.(spawnersRef.current.slice())
    }

    // Spawner mode places or removes one entity per click — no drag, unlike
    // painting (spec §7: "click places a spawner"; hover-to-remove is a
    // separate, cursor-driven affordance the caller renders from the list).
    const toggleSpawner = (x: number, y: number): void => {
      const spawners = spawnersRef.current
      const index = spawners.findIndex((spawner) => spawner.x === x && spawner.y === y)
      if (index >= 0) {
        spawners.splice(index, 1)
      } else {
        spawners.push({ x, y, element: selectedRef.current })
      }
      notifySpawners()
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (modeRef.current === 'spawner') {
        const cell = cellAt(event.clientX, event.clientY)
        if (cell) toggleSpawner(cell.x, cell.y)
        return
      }
      painting = true
      paintAt(event.clientX, event.clientY)
    }
    const onPointerMove = (event: PointerEvent): void => {
      if (painting) paintAt(event.clientX, event.clientY)

      const cell = cellAt(event.clientX, event.clientY)
      if (!cell) {
        onCursorChangeRef.current?.(null)
        return
      }
      const fit = renderer.getFit()
      onCursorChangeRef.current?.({
        cell,
        point: renderer.gridToCanvasPoint(cell.x, cell.y),
        cellSize: fit.width / GRID_WIDTH,
      })
    }
    const stopPainting = (): void => {
      painting = false
    }
    const onPointerLeave = (): void => {
      stopPainting()
      onCursorChangeRef.current?.(null)
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', stopPainting)
    canvas.addEventListener('pointerleave', onPointerLeave)

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
    let lastFpsSample = lastTime
    let framesSinceSample = 0
    function frame(time: number): void {
      const dt = time - lastTime
      lastTime = time
      // Emission is tied to sim ticks, not render frames (spec §7): it runs
      // once per tick, inside the running gate, so it stops the moment the
      // sim pauses — placement itself works regardless.
      if (runningRef.current) {
        timestep.advance(dt, () => {
          emitSpawners(sim, spawnersRef.current)
          sim.tick()
        })
      }
      // `draw` skips an unchanged world (ticket 06), so this counts frames
      // silt actually drew — a paused, untouched world honestly reads 0.
      if (renderer.draw(sim)) framesSinceSample++
      const sinceSample = time - lastFpsSample
      if (sinceSample >= 250) {
        onFpsRef.current?.(Math.round((framesSinceSample * 1000) / sinceSample))
        framesSinceSample = 0
        lastFpsSample = time
      }

      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)

    return () => {
      simRef.current = null
      rendererRef.current = null
      resizeObserver.disconnect()
      stopWatchingDpr()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', stopPainting)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [opts.canvasRef])

  return {
    registry,
    // A step is exactly one sim tick (spec §3), and emission is per tick
    // (spec §7) — so it runs here too, or a spawner scene stays dead under the
    // step button while playing produces material.
    step: () => {
      const sim = simRef.current
      if (!sim) return
      emitSpawners(sim, spawnersRef.current)
      sim.tick()
    },
    // Reset clears cells and spawners together (spec §3, §7).
    reset: () => {
      simRef.current?.clear()
      spawnersRef.current.splice(0, spawnersRef.current.length)
      onSpawnersChangeRef.current?.([])
    },
    gridToCanvasPoint: (x, y) => rendererRef.current?.gridToCanvasPoint(x, y) ?? null,
    cellSize: () => {
      const fit = rendererRef.current?.getFit()
      return fit ? fit.width / GRID_WIDTH : 0
    },
    saveScene: () => {
      const sim = requireSim(simRef.current)
      const envelope = encodeScene(sim, spawnersRef.current, sim.registry)
      // A frame can be skipped now (ticket 06), so a save landing between a
      // paint and the next rAF would snapshot the previous world. This is a
      // no-op whenever the canvas is already current.
      const renderer = rendererRef.current
      renderer?.draw(sim)
      return {
        json: JSON.stringify(envelope),
        thumbnail: renderer?.snapshot() ?? null,
      }
    },
    loadScene: (json) => {
      const sim = requireSim(simRef.current)
      const scene = decodeScene(json, { width: sim.width, height: sim.height }, sim.registry)
      sim.restore(scene.species, scene.ra, scene.rb)
      spawnersRef.current.splice(0, spawnersRef.current.length, ...scene.spawners)
      onSpawnersChangeRef.current?.(spawnersRef.current.slice())
      return scene.warnings
    },
  }
}

function requireSim(sim: Sim | null): Sim {
  if (!sim) throw new Error('the simulation is not running yet')
  return sim
}
