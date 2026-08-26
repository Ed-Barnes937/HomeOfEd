import { useEffect, useRef, useState, type RefObject } from 'react'

import { createRegistry, EMPTY, GRID_WIDTH, v1Elements, v1Reactions, type ElementRegistry } from '../../sim/index.ts'
import { createRenderer } from '../render/createRenderer.ts'
import type { WorldRenderer } from '../render/renderer.ts'
import { brushOffsets } from './brushOffsets.ts'
import { createSimHost, type SimHost } from './simHost.ts'
import { strokeSteps } from './strokeSteps.ts'
import { decodeScene, encodeScene } from '../scenes/sceneCodec.ts'
import { isUnderBrush, type Spawner } from '../spawners/spawners.ts'

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
  /** Which frame path is live — WebGL2, or the Canvas 2D fallback (120fps ticket 01). */
  rendererKind(): '2d' | 'webgl2'
  /** Which thread ticks the sim — a worker, or the main-thread fallback (120fps ticket 02). */
  simHostKind(): 'local' | 'worker'
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
  /** The species painting or spawner placement applies — EMPTY when the erase
   * tool is active, which is also what makes an erase stroke sweep spawners
   * out of its brush footprint. */
  selectedElement: number
  /** Round brush diameter in cells (odd, so it has a centre); 1 = single cell. Spawners ignore this — one entity per click. */
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
 * Owns the SimHost/renderer lifecycle for the page: the sim ticks in its host
 * (a worker where the page is cross-origin isolated, the main thread
 * otherwise — 120fps ticket 02), the rAF loop here only draws the host's live
 * world view. DPR-aware canvas sizing (a ResizeObserver for CSS-size changes
 * plus a `resolution` media-query watcher for zoom-only devicePixelRatio
 * changes — both refit the canvas only, the sim is never touched) and
 * click/drag painting stay main-side. React owns
 * `running`/`selectedElement`/`brushWidth`; changes are pushed into the loop
 * via refs, never by restarting the effect, so toggling play/pause never
 * resets the world. `step`/`reset` are exposed so the page's header buttons
 * can reach into the same host.
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
  const hostRef = useRef<SimHost | null>(null)
  /** The `running` value the host last heard — sends happen on change only. */
  const sentRunningRef = useRef<boolean | null>(null)
  const rendererRef = useRef<WorldRenderer | null>(null)
  const spawnersRef = useRef<Spawner[]>([])
  // Same defaults `Sim` itself falls back to, so the rail matches the canvas
  // from first paint — swapped for the host's own `registry` once it mounts.
  const [registry, setRegistry] = useState<ElementRegistry>(() => createRegistry(v1Elements, v1Reactions))

  // One effect syncing all the latest-value refs (ticket 15), rather than one
  // per option — still an effect, not a render-phase write, so it doesn't
  // misbehave under concurrent rendering and StrictMode double-invocation.
  // Running is the one value the host must *hear about* (it owns the tick
  // loop now), so a change is also forwarded — deduplicated, or every render
  // would send a message.
  useEffect(() => {
    runningRef.current = opts.running
    selectedRef.current = opts.selectedElement
    brushRef.current = opts.brushWidth
    modeRef.current = opts.mode
    onPaintRef.current = opts.onPaint
    onCursorChangeRef.current = opts.onCursorChange
    onFpsRef.current = opts.onFps
    onSpawnersChangeRef.current = opts.onSpawnersChange
    if (hostRef.current && sentRunningRef.current !== opts.running) {
      sentRunningRef.current = opts.running
      hostRef.current.send({ type: 'setRunning', running: opts.running })
    }
  })

  // canvasRef identity is stable across renders; the options above are synced
  // into the running loop by the effect above, not by re-running this one.
  useEffect(() => {
    const canvas = opts.canvasRef.current
    if (!canvas) return

    // A worker when the page is cross-origin isolated, the main thread
    // otherwise (120fps ticket 02). The host owns the tick loop; this effect
    // owns input and drawing.
    const host = createSimHost()
    hostRef.current = host
    setRegistry(host.registry)
    sentRunningRef.current = runningRef.current
    host.send({ type: 'setRunning', running: runningRef.current })

    // Hidden pauses ticking (without touching `running`), matching the old
    // rAF-driven loop, where a backgrounded tab stopped advancing.
    const onVisibility = (): void => {
      host.send({ type: 'setVisible', visible: document.visibilityState === 'visible' })
    }
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)

    // WebGL2 when available, the Canvas 2D renderer otherwise (120fps ticket 01).
    const renderer = createRenderer(canvas, host.registry)
    rendererRef.current = renderer

    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    renderer.resize(width, height, window.devicePixelRatio || 1)

    // The canvas's on-screen box, cached. `getBoundingClientRect` forces a
    // layout, and `onPointerMove` would otherwise pay for two of them per
    // event while dragging (once for the cursor readout, once inside
    // `paintAt`) — at a trackpad's 120 Hz report rate, on the frame the sim is
    // busiest. Read eagerly here so it is already right on the first pointer
    // event, before any observer has fired.
    //
    // A stale rect is a *correctness* bug — paint lands in the wrong cell and
    // the brush outline detaches from the pointer — so every way the box can
    // move refreshes it: the ResizeObserver and the DPR watcher (the canvas's
    // own size), window resize (the viewport, which moves a centred canvas
    // without resizing it), and scroll. Scroll is captured on `window` because
    // scroll events do not bubble: only the capture phase sees an ancestor
    // scroller's scroll.
    let rect = canvas.getBoundingClientRect()
    const refreshRect = (): void => {
      rect = canvas.getBoundingClientRect()
    }

    const refit = (): void => {
      refreshRect()
      renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1)
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      refreshRect()
      const { width: w, height: h } = entry.contentRect
      renderer.resize(w, h, window.devicePixelRatio || 1)
    })
    resizeObserver.observe(canvas)

    window.addEventListener('scroll', refreshRect, { capture: true, passive: true })
    window.addEventListener('resize', refreshRect, { passive: true })

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

    const cellAt = (clientX: number, clientY: number): { x: number; y: number } | null =>
      renderer.canvasPointToGrid(clientX - rect.left, clientY - rect.top)

    const view = host.view
    let painting = false
    // The last cell the current stroke stamped — what `paintAt` interpolates
    // from, so a fast drag reads as a line, not a dot per pointer sample.
    let lastPaintCell: { x: number; y: number } | null = null
    // Brush geometry (round footprint, stroke interpolation, the spawner
    // erase sweep) stays main-side; the host only hears cell indices. One
    // batched message per pointer event — the round trip is longer than a
    // pointer event, so per-cell messages would flood the channel.
    const stampAt = (cell: { x: number; y: number }, out: number[]): void => {
      for (const { dx, dy } of brushOffsets(brushRef.current)) {
        const x = cell.x + dx
        const y = cell.y + dy
        if (x < 0 || y < 0 || x >= view.width || y >= view.height) continue
        out.push(y * view.width + x)
      }
      // Erase clears the world under the brush, and a spawner is part of that
      // world even though it isn't a cell — leaving it behind would refill the
      // hole the stroke just made.
      if (selectedRef.current === EMPTY) eraseSpawnersUnder(cell)
    }
    const paintAt = (clientX: number, clientY: number): void => {
      const cell = cellAt(clientX, clientY)
      if (!cell) return
      const from = lastPaintCell
      lastPaintCell = cell
      const cellIndices: number[] = []
      if (from) {
        for (const step of strokeSteps(from, cell, brushRef.current)) stampAt(step, cellIndices)
      } else {
        stampAt(cell, cellIndices)
      }
      if (cellIndices.length > 0) {
        host.send({ type: 'paintCells', cellIndices, species: selectedRef.current })
      }
      onPaintRef.current?.()
    }

    // Spawners are entities owned here (the page draws their chrome); the
    // host holds a copy purely for per-tick emission, refreshed on every
    // change alongside the React notification.
    const syncSpawners = (): void => {
      host.send({ type: 'setSpawners', spawners: spawnersRef.current.slice() })
      onSpawnersChangeRef.current?.(spawnersRef.current.slice())
    }

    const eraseSpawnersUnder = (cell: { x: number; y: number }): void => {
      const spawners = spawnersRef.current
      const kept = spawners.filter((spawner) => !isUnderBrush(spawner, cell, brushRef.current))
      if (kept.length === spawners.length) return
      spawners.splice(0, spawners.length, ...kept)
      syncSpawners()
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
      syncSpawners()
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (modeRef.current === 'spawner') {
        const cell = cellAt(event.clientX, event.clientY)
        if (cell) toggleSpawner(cell.x, cell.y)
        return
      }
      painting = true
      // A fresh press starts a fresh stroke — never a line from the last one.
      lastPaintCell = null
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
      lastPaintCell = null
    }
    const onPointerLeave = (): void => {
      stopPainting()
      onCursorChangeRef.current?.(null)
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', stopPainting)
    canvas.addEventListener('pointerleave', onPointerLeave)

    ;(canvas as unknown as Record<string, SiltTestSeam>)[TEST_SEAM_KEY] = {
      // Reads go straight to the (shared) cell bytes, so the seam stays
      // synchronous in worker mode too — its consumers poll, so a paint that
      // is still in flight simply shows up a read later.
      speciesAt: (x, y) => view.speciesAt(x, y),
      countSpecies: (species) => view.countSpecies(species),
      gridToCanvasPoint: (x, y) => renderer.gridToCanvasPoint(x, y),
      rendererKind: () => renderer.kind,
      simHostKind: () => host.kind,
    }

    // The tick loop lives in the host — this rAF loop only draws whatever
    // revision the world has reached (spec §5.3's decoupling, now literal).
    let rafId = 0
    let lastFpsSample = performance.now()
    let framesSinceSample = 0
    function frame(time: number): void {
      // `draw` skips an unchanged world (ticket 06), so this counts frames
      // silt actually drew — a paused, untouched world honestly reads 0.
      if (renderer.draw(view)) framesSinceSample++
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
      hostRef.current = null
      rendererRef.current = null
      host.dispose()
      renderer.dispose?.()
      resizeObserver.disconnect()
      stopWatchingDpr()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('scroll', refreshRect, { capture: true })
      window.removeEventListener('resize', refreshRect)
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
    // (spec §7) — the host runs both in order, or a spawner scene stays dead
    // under the step button while playing produces material.
    step: () => {
      hostRef.current?.send({ type: 'step' })
    },
    // Reset clears cells and spawners together (spec §3, §7).
    reset: () => {
      const host = hostRef.current
      if (!host) return
      host.send({ type: 'reset' })
      spawnersRef.current.splice(0, spawnersRef.current.length)
      host.send({ type: 'setSpawners', spawners: [] })
      onSpawnersChangeRef.current?.([])
    },
    gridToCanvasPoint: (x, y) => rendererRef.current?.gridToCanvasPoint(x, y) ?? null,
    cellSize: () => {
      const fit = rendererRef.current?.getFit()
      return fit ? fit.width / GRID_WIDTH : 0
    },
    saveScene: () => {
      const host = requireHost(hostRef.current)
      const envelope = encodeScene(host.view, spawnersRef.current, host.registry)
      // A frame can be skipped now (ticket 06), so a save landing between a
      // paint and the next rAF would snapshot the previous world. This is a
      // no-op whenever the canvas is already current.
      const renderer = rendererRef.current
      renderer?.draw(host.view)
      return {
        json: JSON.stringify(envelope),
        thumbnail: renderer?.snapshot() ?? null,
      }
    },
    loadScene: (json) => {
      const host = requireHost(hostRef.current)
      const scene = decodeScene(json, { width: host.view.width, height: host.view.height }, host.registry)
      host.send({ type: 'restore', species: scene.species, ra: scene.ra, rb: scene.rb })
      spawnersRef.current.splice(0, spawnersRef.current.length, ...scene.spawners)
      host.send({ type: 'setSpawners', spawners: spawnersRef.current.slice() })
      onSpawnersChangeRef.current?.(spawnersRef.current.slice())
      return scene.warnings
    },
  }
}

function requireHost(host: SimHost | null): SimHost {
  if (!host) throw new Error('the simulation is not running yet')
  return host
}
