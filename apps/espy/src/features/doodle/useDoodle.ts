/**
 * The integration keystone (spec §8). Owns the canvas lifecycle, pointer
 * handling, history, session restore, the bloom animation, save/share, the
 * Cmd/Ctrl-Z shortcut, and the test seam.
 *
 * React holds ONLY `tool`/`nib`/`canUndo` as state. The drawing itself is NOT
 * React state — it lives in refs and is projected imperatively onto the canvas,
 * so a stroke never triggers a re-render (spec §8, root CLAUDE §3). This and
 * `render/surface.ts` are the only modules allowed to touch a canvas/DOM.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { computeFit, toLogical, type Fit } from './engine/coords.ts'
import { makeEye, EYE_BASE } from './engine/eye.ts'
import { generateField } from './engine/field.ts'
import { currentViewBox, History } from './engine/history.ts'
import type { Point, ViewBox } from './engine/types.ts'
import { DoodleSurface } from './render/surface.ts'
import { loadSession, saveSession } from './session.ts'
import { SKETCHBOOK } from './theme.ts'
import { BLOOM_MS, bloomAlpha, initialOps } from './useDoodle.helpers.ts'

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
    let bloomRaf = 0
    let saveTimer = 0
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

    const render = (h: History, alpha = 1): void => surface.renderOps(h.ops, SKETCHBOOK, alpha)

    /** One-shot alpha ramp (spec §7); reduced-motion renders the final frame once. */
    const bloom = (h: History): void => {
      if (bloomRaf) cancelAnimationFrame(bloomRaf)
      if (reducedMotion) {
        render(h, 1)
        return
      }
      const start = performance.now()
      const step = (now: number): void => {
        const elapsed = now - start
        if (elapsed >= BLOOM_MS) {
          render(h, 1)
          bloomRaf = 0
          return
        }
        render(h, bloomAlpha(elapsed))
        bloomRaf = requestAnimationFrame(step)
      }
      bloomRaf = requestAnimationFrame(step)
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
      history.push({ type: 'field', viewBox, blots: generateField(viewBox, Math.random) })
      bloom(history)
      setCanUndo(history.canUndo)
      flushSave(history)
    }

    const doUndo = (): void => {
      if (!history) return
      history.undo()
      render(history)
      setCanUndo(history.canUndo)
      flushSave(history)
    }

    const doSave = async (): Promise<void> => {
      if (!history) return
      render(history) // ensure a crisp, fully-bloomed final frame
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      )
      if (!blob) return
      const file = new File([blob], 'espy.png', { type: 'image/png' })
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Espy' })
        } else {
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = 'espy.png'
          anchor.click()
          URL.revokeObjectURL(url)
        }
      } catch (error) {
        if ((error as Error | undefined)?.name !== 'AbortError') throw error
      }
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
      if (decision.bloom) bloom(history)
      else render(history)
    }
    init()

    return () => {
      if (sizeRaf) cancelAnimationFrame(sizeRaf)
      if (bloomRaf) cancelAnimationFrame(bloomRaf)
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
