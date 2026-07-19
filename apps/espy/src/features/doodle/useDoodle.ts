/**
 * The integration keystone (spec §8). Owns the canvas lifecycle, pointer
 * handling, history, session restore, the ink-in-water field bloom, save/share,
 * the Cmd/Ctrl-Z shortcut, and the test seam.
 *
 * React holds ONLY `tool`/`nib`/`canUndo` as state. The drawing itself is NOT
 * React state — it lives in refs and is projected imperatively onto the canvas,
 * so a stroke never triggers a re-render (spec §8, root CLAUDE §3). This and
 * `render/surface.ts`/`render/fluid.ts` are the only modules allowed to touch a
 * canvas/DOM.
 */
import { Capacitor } from '@capacitor/core'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { computeFit, toLogical, type Fit } from './engine/coords.ts'
import { makeEye, EYE_BASE } from './engine/eye.ts'
import { generateField } from './engine/field.ts'
import { currentViewBox, History, visibleOps } from './engine/history.ts'
import { blobRadiusFraction } from './engine/layout.ts'
import type { Blot, Op, Point, ViewBox } from './engine/types.ts'
import { BRUSH_ORDER } from './render/fluid.helpers.ts'
import { fluidSupported, runFluidField } from './render/fluid.ts'
import { cloneTuning, liveDebug, liveTuning } from './render/fluid.tuning.ts'
import { DoodleSurface } from './render/surface.ts'
import { saveImage, type SaveCaps } from './save.ts'
import { loadSession, saveSession } from './session.ts'
import { SKETCHBOOK } from './theme.ts'
import { initialOps } from './useDoodle.helpers.ts'

export type Tool = 'pen' | 'eyes'

export interface UseDoodle {
  canvasRef: RefObject<HTMLCanvasElement | null>
  tool: Tool
  setTool: (t: Tool) => void
  nib: number
  setNib: (w: number) => void
  newPage: () => void
  undo: () => void
  canUndo: boolean
  save: () => Promise<void>
}

/** Nib widths in logical px: thin / medium (default) / thick. */
export const NIB_SIZES = [1.8, 3.4, 6] as const

/** Debounce window for localStorage writes during a drag (spec §8). */
const SAVE_DEBOUNCE_MS = 300

/** Minimum CSS extent before the canvas is considered laid out (spec §8). */
const MIN_CSS_PX = 4

/** Longest edge of the persisted field raster — keeps the localStorage copy small. */
const PERSIST_CAP_PX = 1024

// --- Test seam (spec §8.1) --------------------------------------------------

export const DOODLE_SEAM_KEY = '__espyTestSeam'

/** Read from outside React by the POM — mirrors boids' window-key seam. */
export interface DoodleTestSeam {
  counts(): { fields: number; blots: number; strokes: number; eyes: number }
  historyDepth(): number
  viewBox(): ViewBox
}

interface Ops {
  newPage(): void
  undo(): void
  save(): Promise<void>
}

const NOOP_OPS: Ops = {
  newPage: () => {},
  undo: () => {},
  save: () => Promise.resolve(),
}

/**
 * Runtime wiring for the save seam (`save.ts`). Lives here because only this
 * module (plus render/*) may touch the DOM. Under the Capacitor shell the
 * native share sheet is used (ADR 0017 §4). On the web, the share sheet is
 * preferred only on touch-primary devices (phones, tablets), where it offers
 * Save-to-Files/Photos; on desktop (Mac, Windows) it has no download option —
 * go straight to an anchor download (feedback: Mac save dialog can't download).
 */
function saveCaps(): SaveCaps {
  return {
    isNative: Capacitor.isNativePlatform(),
    canShareFiles: (file) =>
      navigator.maxTouchPoints > 0 && (navigator.canShare?.({ files: [file] }) ?? false),
    shareFiles: async (file, title) => {
      await navigator.share({ files: [file], title })
    },
    download: (blob, filename) => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    },
    // Lazy import: the Capacitor plugins never load on the web, where
    // isNative is false and this cap is unreachable.
    nativeShare: (blob, filename) =>
      import('./save.native.ts').then((m) => m.nativeShare(blob, filename)),
  }
}

/** The current field op (the last one) — the field the canvas is showing. */
function currentField(ops: readonly Op[]): (Op & { type: 'field' }) | null {
  const f = visibleOps(ops)[0]
  return f && f.type === 'field' ? f : null
}

/** TEMPORARY (`?tune` grid): a fixed 3×2 layout, one blot per brush archetype in
 * `BRUSH_ORDER`, so the sim can be forced to one-of-each in stable positions.
 * Columns are kept in the left ~70% so the rightmost mark clears the tuner panel. */
function debugGridBlots(w: number, h: number): Blot[] {
  const colX = [0.13, 0.39, 0.65] // fractions of width — left of the panel
  const rowY = [0.3, 0.72]
  // Match a real 6-blot field's blot size so the grid previews true-to-app marks.
  const r = Math.min(w, h) * blobRadiusFraction(BRUSH_ORDER.length)
  return BRUSH_ORDER.map((_, i) => ({
    cx: w * colX[i % colX.length]!,
    cy: h * rowY[Math.floor(i / colX.length)]!,
    r,
    points: [],
    satellites: [],
  }))
}

/** Downscale the baked field to a small JPEG data URL for session restore. */
function toPersistDataURL(baked: HTMLCanvasElement): string {
  const longest = Math.max(baked.width, baked.height)
  const scale = Math.min(1, PERSIST_CAP_PX / longest)
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(baked.width * scale))
  c.height = Math.max(1, Math.round(baked.height * scale))
  c.getContext('2d')!.drawImage(baked, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
}

export function useDoodle(): UseDoodle {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [tool, setToolState] = useState<Tool>('pen')
  const [nib, setNibState] = useState<number>(NIB_SIZES[1])
  const [canUndo, setCanUndo] = useState(false)

  // Live values the imperative pointer handlers read without re-subscribing.
  const toolRef = useRef<Tool>(tool)
  const nibRef = useRef<number>(nib)
  useEffect(() => {
    toolRef.current = tool
  }, [tool])
  useEffect(() => {
    nibRef.current = nib
  }, [nib])

  // Set inside the mount effect once the surface/history exist; the returned
  // callbacks delegate through this so their identity stays stable.
  const opsRef = useRef<Ops>(NOOP_OPS)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const surface = new DoodleSurface(canvas)
    const cssSize = { w: 0, h: 0 }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let history: History | null = null
    let sizeRaf = 0
    let saveTimer = 0
    // The baked ink-in-water raster per field op (undo across pages needs each).
    const fieldImages = new Map<Op, CanvasImageSource>()
    // The field whose sim is still running — drawn as bare paper (the GL overlay
    // shows the bloom on top) until its raster bakes.
    let pendingField: Op | null = null
    let fluidAbort: AbortController | null = null
    // Per-stroke drag state.
    let activePointerId: number | null = null
    let draft: Point[] | null = null
    let fit: Fit | null = null

    const attachSeam = (h: History): void => {
      const seam: DoodleTestSeam = {
        counts: () => h.counts(),
        historyDepth: () => h.ops.length,
        viewBox: () => currentViewBox(h.ops),
      }
      ;(canvas as unknown as Record<string, DoodleTestSeam>)[DOODLE_SEAM_KEY] = seam
    }

    const render = (h: History): void => {
      const field = currentField(h.ops)
      if (field && field === pendingField && !fieldImages.has(field)) {
        // Sim in flight for this field — leave bare paper under the GL overlay.
        surface.paintPaper(SKETCHBOOK.paper)
        return
      }
      surface.renderOps(h.ops, SKETCHBOOK, field ? fieldImages.get(field) ?? null : null)
    }

    /** Decode a restored field's baked raster (if any) and repaint once ready. */
    const ensureFieldImage = (h: History): void => {
      const field = currentField(h.ops)
      if (!field || fieldImages.has(field) || !field.baked) return
      const img = new Image()
      img.onload = (): void => {
        fieldImages.set(field, img)
        render(h)
      }
      img.src = field.baked
    }

    /** Run the ink-in-water sim for `field`, bake it, and repaint. */
    const startFluid = (h: History, field: Op & { type: 'field' }): void => {
      fluidAbort?.abort()
      if (!fluidSupported()) {
        pendingField = null
        render(h) // no WebGL → plain blot fallback
        return
      }
      fluidAbort = new AbortController()
      pendingField = field
      render(h) // bare paper; the overlay carries the bloom

      let run: Promise<HTMLCanvasElement>
      try {
        run = runFluidField({
          overCanvas: canvas,
          cssW: cssSize.w,
          cssH: cssSize.h,
          dpr: window.devicePixelRatio || 1,
          seeds: field.blots.map((b) => ({ x: b.cx, y: b.cy, r: b.r })),
          paper: SKETCHBOOK.paper,
          ink: SKETCHBOOK.ink,
          rngSeed: liveDebug.grid ? 1 : Math.floor(Math.random() * 0xffffffff),
          animate: !reducedMotion,
          tuning: cloneTuning(liveTuning.current), // frozen per run (debug: ?tune)
          forceBrushes: liveDebug.grid ? BRUSH_ORDER : undefined,
          signal: fluidAbort.signal,
        })
      } catch {
        if (pendingField === field) pendingField = null
        render(h)
        return
      }

      run
        .then((baked) => {
          fieldImages.set(field, baked)
          field.baked = toPersistDataURL(baked)
          if (pendingField === field) pendingField = null
          render(h)
          flushSave(h)
        })
        .catch((error: unknown) => {
          if ((error as Error | undefined)?.name === 'AbortError') return
          if (pendingField === field) pendingField = null
          render(h) // sim failed → plain blot fallback
        })
    }

    const scheduleSave = (h: History): void => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => {
        saveSession(h.ops, localStorage)
        saveTimer = 0
      }, SAVE_DEBOUNCE_MS)
    }
    const flushSave = (h: History): void => {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = 0
      }
      saveSession(h.ops, localStorage)
    }

    const clientToLogical = (event: PointerEvent, f: Fit): Point => {
      const rect = canvas.getBoundingClientRect()
      return toLogical({ x: event.clientX - rect.left, y: event.clientY - rect.top }, f)
    }

    // --- Pointer handlers (Pointer Events + capture; palm rejection) --------

    const onPointerDown = (event: PointerEvent): void => {
      if (!history || activePointerId !== null) return // ignore secondary pointers
      activePointerId = event.pointerId
      canvas.setPointerCapture(event.pointerId)
      fit = computeFit(currentViewBox(history.ops), cssSize.w, cssSize.h)
      const p = clientToLogical(event, fit)
      if (toolRef.current === 'pen') {
        draft = [p]
      } else {
        history.push({ type: 'eye', eye: makeEye(p.x, p.y, EYE_BASE, Math.random) })
        render(history)
        setCanUndo(history.canUndo)
        scheduleSave(history)
      }
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId || !draft || !fit) return
      const p = clientToLogical(event, fit)
      const prev = draft[draft.length - 1]!
      draft.push(p)
      surface.drawLiveSegment(prev, p, SKETCHBOOK.ink, nibRef.current, fit)
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId || !history) return
      try {
        canvas.releasePointerCapture(event.pointerId)
      } catch {
        // capture may already be gone (e.g. pointercancel) — ignore.
      }
      if (draft && draft.length >= 1) {
        history.push({
          type: 'stroke',
          stroke: { color: SKETCHBOOK.ink, width: nibRef.current, points: draft },
        })
        render(history)
        setCanUndo(history.canUndo)
      }
      draft = null
      fit = null
      activePointerId = null
      flushSave(history)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    // --- Returned operations ------------------------------------------------

    const doNewPage = (): void => {
      if (!history) return
      const viewBox: ViewBox = { width: cssSize.w, height: cssSize.h }
      const field: Op & { type: 'field' } = {
        type: 'field',
        viewBox,
        blots: liveDebug.grid
          ? debugGridBlots(cssSize.w, cssSize.h)
          : generateField(viewBox, Math.random),
      }
      history.push(field)
      setToolState('pen') // a fresh page always starts on the pen (feedback)
      setCanUndo(history.canUndo)
      flushSave(history) // persist the seeds now; the baked raster follows
      startFluid(history, field)
    }

    const doUndo = (): void => {
      if (!history) return
      history.undo()
      ensureFieldImage(history) // the revealed field may need its raster decoded
      render(history)
      setCanUndo(history.canUndo)
      flushSave(history)
    }

    const doSave = async (): Promise<void> => {
      if (!history) return
      render(history) // ensure the settled field frame is on the canvas
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      )
      if (!blob) return
      await saveImage(blob, 'espy.png', 'Espy', saveCaps())
    }

    opsRef.current = { newPage: doNewPage, undo: doUndo, save: doSave }

    // --- Keyboard: Cmd/Ctrl-Z (only shortcut) -------------------------------

    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        doUndo()
      }
    }
    window.addEventListener('keydown', onKeyDown)

    // --- Resize: refit + redraw, never regenerate (spec §8) -----------------

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width < MIN_CSS_PX || height < MIN_CSS_PX) return
      cssSize.w = width
      cssSize.h = height
      surface.resize(width, height, window.devicePixelRatio || 1)
      if (history) render(history)
    })
    resizeObserver.observe(canvas)

    // --- Mount: size, then restore-or-generate ------------------------------

    const init = (): void => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w < MIN_CSS_PX || h < MIN_CSS_PX) {
        sizeRaf = requestAnimationFrame(init) // layout not ready — retry next frame
        return
      }
      cssSize.w = w
      cssSize.h = h
      surface.resize(w, h, window.devicePixelRatio || 1)

      const decision = initialOps(loadSession(localStorage), cssSize, Math.random)
      history = new History(decision.ops)
      attachSeam(history)
      setCanUndo(history.canUndo)
      if (decision.bloom) {
        const field = currentField(history.ops)
        if (field) startFluid(history, field)
        else render(history)
      } else {
        render(history) // restore: plain blots first, then the baked raster
        ensureFieldImage(history)
      }
    }
    init()

    return () => {
      if (sizeRaf) cancelAnimationFrame(sizeRaf)
      fluidAbort?.abort()
      if (saveTimer) clearTimeout(saveTimer)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
      opsRef.current = NOOP_OPS
    }
  }, [])

  const setTool = useCallback((t: Tool) => setToolState(t), [])
  const setNib = useCallback((w: number) => setNibState(w), [])
  const newPage = useCallback(() => opsRef.current.newPage(), [])
  const undo = useCallback(() => opsRef.current.undo(), [])
  const save = useCallback(() => opsRef.current.save(), [])

  return { canvasRef, tool, setTool, nib, setNib, newPage, undo, canUndo, save }
}
