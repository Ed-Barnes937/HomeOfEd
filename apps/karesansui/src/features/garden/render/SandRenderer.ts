/**
 * The sand canvas — a reshaping of the Studio reference's `cv`/`renderPreview`/
 * `startRake`+`rakeTick`/`smooth`/`exportImg` into an externally-driven API.
 *
 * The rAF loop lives in the hook (Phase 3): `carveTo`/`smoothStep` take a
 * progress in `0..1` and draw the delta since the last call. This class owns
 * the canvas + 2D context and the carve cursor; it holds no React.
 */
import { normals } from '../engine/geom.ts'
import type { Geom } from '../engine/geom.ts'
import { rakePresets } from '../engine/rake.ts'
import type { RakePreset } from '../engine/rake.ts'
import type { RakeId } from '../engine/state.ts'
import { clipCircle, rakeSegment, sandFill } from './sand.ts'

type Point = [number, number]

export class SandRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  /** Square CSS edge; drawing coordinates are CSS px under the DPR transform. */
  private cssSize = 0

  // carve cursor — valid between beginCarve and finishCarve
  private geom: Geom | null = null
  private norm: Point[] = []
  private rakePreset: RakePreset | null = null
  private lastIndex = 0
  private pointCount = 0
  private carved = false

  // smoothing sweep — the fresh sand board revealed left→right
  private freshSand: HTMLCanvasElement | null = null

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.canvas = canvas
    this.ctx = ctx
  }

  /**
   * Rebuild the backing store for a square `cssSize` bed. DPR is capped at 2
   * (the reference `cv()` cap); after this the context draws in CSS px. The
   * caller re-invokes `renderStatic`/redraw — resize never animates (D6).
   */
  resize(cssSize: number, dpr: number): void {
    const d = Math.min(dpr, 2)
    this.cssSize = cssSize
    this.canvas.width = Math.round(cssSize * d)
    this.canvas.height = Math.round(cssSize * d)
    this.ctx.setTransform(d, 0, 0, d, 0, 0)
  }

  /** Fill sand and, when enabled, the faint guide line of the pattern. */
  renderStatic(geom: Geom, showPreview: boolean): void {
    const ctx = this.ctx
    const w = this.cssSize
    const h = this.cssSize
    ctx.save()
    clipCircle(ctx, w, h)
    sandFill(ctx, w, h)
    if (showPreview) {
      ctx.beginPath()
      let started = false
      for (const p of geom.pts) {
        const x = p[0] + w / 2
        const y = p[1] + h / 2
        if (started) ctx.lineTo(x, y)
        else {
          ctx.moveTo(x, y)
          started = true
        }
      }
      ctx.strokeStyle = 'rgba(120,92,53,.26)'
      ctx.lineWidth = 1
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
    ctx.restore()
    this.carved = false
  }

  /** Reset the carve cursor, clip to the bed, and lay down fresh sand. */
  beginCarve(geom: Geom, rake: RakeId): void {
    const ctx = this.ctx
    const w = this.cssSize
    const h = this.cssSize
    this.geom = geom
    this.norm = normals(geom.pts)
    this.rakePreset = rakePresets()[rake]
    this.lastIndex = 0
    this.pointCount = geom.pts.length
    this.carved = false
    ctx.save()
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2)
    ctx.clip()
    sandFill(ctx, w, h)
  }

  /** Draw rake grooves from the last cursor up to `progress` (0..1). */
  carveTo(progress: number): void {
    const geom = this.geom
    const rake = this.rakePreset
    if (!geom || !rake) return
    const p = Math.max(0, Math.min(1, progress))
    const target = Math.max(1, Math.round(p * (this.pointCount - 1)))
    if (target > this.lastIndex) {
      rakeSegment(
        this.ctx,
        geom.pts,
        this.norm,
        rake,
        this.lastIndex,
        target,
        this.cssSize / 2,
        this.cssSize / 2,
      )
      this.lastIndex = target
    }
  }

  /**
   * Sweep a leveling board left→right over the carved bed (0..1), revealing
   * fresh sand with a pushed-sand shadow, a bright leading lip and a trailing
   * comb. The fresh board is built lazily on the first call and released at 1.
   */
  smoothStep(progress: number): void {
    const ctx = this.ctx
    const w = this.cssSize
    const h = this.cssSize
    if (!this.freshSand) this.freshSand = this.buildFreshSand(w, h)
    const fresh = this.freshSand
    const p = Math.max(0, Math.min(1, progress))
    const x = p * (w + 34) - 14
    ctx.save()
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2)
    ctx.clip()
    const bw = Math.max(0, Math.min(w, x))
    if (fresh && bw > 0) ctx.drawImage(fresh, 0, 0, bw, h, 0, 0, bw, h)
    if (p < 1) {
      const grad = ctx.createLinearGradient(x - 26, 0, x + 6, 0)
      grad.addColorStop(0, 'rgba(90,66,36,0)')
      grad.addColorStop(0.62, 'rgba(96,70,38,.2)')
      grad.addColorStop(1, 'rgba(120,90,50,.4)')
      ctx.fillStyle = grad
      ctx.fillRect(x - 26, 0, 32, h)
      ctx.fillStyle = 'rgba(255,250,236,.7)'
      ctx.fillRect(x, 0, 2.5, h)
      ctx.fillStyle = 'rgba(120,92,53,.16)'
      for (let i = 1; i <= 3; i++) ctx.fillRect(x - i * 7, 0, 1, h)
    }
    ctx.restore()
    if (p >= 1) {
      this.freshSand = null
      this.carved = true
    }
  }

  /** Restore the clip pushed by `beginCarve` and mark the bed carved. */
  finishCarve(): void {
    try {
      this.ctx.restore()
    } catch {
      // no matching save (e.g. resize interrupted the carve) — nothing to undo
    }
    this.carved = true
  }

  /** PNG data URL of the current sand bed — the Export source. */
  toDataURL(): string {
    return this.canvas.toDataURL('image/png')
  }

  /** Whether the bed currently holds a completed pattern (vs. preview sand). */
  isCarved(): boolean {
    return this.carved
  }

  /** An offscreen circular sand board, matched to the bed's CSS size. */
  private buildFreshSand(w: number, h: number): HTMLCanvasElement | null {
    const fresh = document.createElement('canvas')
    fresh.width = w
    fresh.height = h
    const fctx = fresh.getContext('2d')
    if (!fctx) return null
    fctx.save()
    clipCircle(fctx, w, h)
    sandFill(fctx, w, h)
    fctx.restore()
    return fresh
  }
}
