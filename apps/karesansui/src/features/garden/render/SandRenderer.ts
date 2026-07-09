/**
 * The sand canvas — the "many pens, one garden" bed (plan 0008). Owns the
 * canvas + 2D context; holds no React.
 *
 * Each frame redraws the whole bed: the flat single-colour sand, then one groove
 * per cog carved up to the current fraction, then a gold marble at each groove's
 * tip. The rAF loop in `useRakeLoop` drives `carveTo(progress)` (draw) and
 * `clearTo(sweep)` (the optional clearing rake). Both take a 0..1 value; marbles
 * from every cog complete together at `carveTo(1)`.
 */
import type { Garden } from '../engine/garden.ts'
import { clipCircle, clearingSweep, drawGroove, drawMarble, gardenBed } from './sand.ts'

export class SandRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  /** Square CSS edge; drawing coordinates are CSS px under the DPR transform. */
  private cssSize = 0

  private garden: Garden | null = null
  private carved = false

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.canvas = canvas
    this.ctx = ctx
  }

  /**
   * Rebuild the backing store for a square `cssSize` bed. DPR is capped at 2;
   * after this the context draws in CSS px. The caller re-invokes the redraw.
   */
  resize(cssSize: number, dpr: number): void {
    const d = Math.min(dpr, 2)
    this.cssSize = cssSize
    this.canvas.width = Math.round(cssSize * d)
    this.canvas.height = Math.round(cssSize * d)
    this.ctx.setTransform(d, 0, 0, d, 0, 0)
  }

  /** The sand board radius (matches the `boardR` the garden was fit to). */
  private boardR(): number {
    return this.cssSize * 0.46
  }

  /** Flat bed and, when enabled, a faint ghost of every cog's full groove path. */
  renderStatic(garden: Garden, showPreview: boolean): void {
    const ctx = this.ctx
    const w = this.cssSize
    const cx = w / 2
    const cy = w / 2
    this.garden = garden
    ctx.save()
    clipCircle(ctx, w, w)
    gardenBed(ctx, cx, cy, this.boardR())
    if (showPreview) {
      for (const curve of garden.curves) {
        ctx.beginPath()
        for (let i = 0; i < curve.pts.length; i++) {
          const q = curve.pts[i]
          if (!q) continue
          if (i === 0) ctx.moveTo(q[0] + cx, q[1] + cy)
          else ctx.lineTo(q[0] + cx, q[1] + cy)
        }
        ctx.strokeStyle = 'rgba(60,36,14,.2)'
        ctx.lineWidth = 1
        ctx.lineJoin = 'round'
        ctx.stroke()
      }
    }
    ctx.restore()
    this.carved = false
  }

  /** Store the garden to carve and lay down a fresh flat bed. */
  beginCarve(garden: Garden): void {
    this.garden = garden
    this.carved = false
    this.drawFrame(0.01, null)
  }

  /** Redraw the bed with every groove carved up to `progress` (0..1) + marbles. */
  carveTo(progress: number): void {
    this.drawFrame(Math.max(0, Math.min(1, progress)), null)
  }

  /** Redraw the finished pattern with the clearing rake swept to `sweep` (0..1). */
  clearTo(sweep: number): void {
    this.drawFrame(1, Math.max(0, Math.min(1, sweep)))
    if (sweep >= 1) this.carved = false
  }

  /** Mark the bed as holding a completed pattern. */
  finishCarve(): void {
    this.carved = true
  }

  /** PNG data URL of the current sand bed — the Download source. */
  toDataURL(): string {
    return this.canvas.toDataURL('image/png')
  }

  /** Whether the bed currently holds a completed pattern (vs. preview sand). */
  isCarved(): boolean {
    return this.carved
  }

  /**
   * One frame: flat bed, each cog's groove up to `frac`, then either the marbles
   * at each tip (`sweep === null`) or the clearing-rake sweep over the finished
   * grooves (`sweep` ∈ [0, 1]).
   */
  private drawFrame(frac: number, sweep: number | null): void {
    const garden = this.garden
    if (!garden) return
    const ctx = this.ctx
    const w = this.cssSize
    const cx = w / 2
    const cy = w / 2
    ctx.save()
    clipCircle(ctx, w, w)
    gardenBed(ctx, cx, cy, this.boardR())
    for (const curve of garden.curves) {
      const upto = Math.max(2, Math.floor((curve.pts.length - 1) * frac))
      drawGroove(ctx, curve.pts, upto, cx, cy)
    }
    if (sweep === null) {
      for (const curve of garden.curves) {
        const upto = Math.max(2, Math.floor((curve.pts.length - 1) * frac))
        const tip = curve.pts[upto]
        if (tip) drawMarble(ctx, tip[0] + cx, tip[1] + cy)
      }
    } else {
      clearingSweep(ctx, cx, cy, this.boardR(), sweep)
    }
    ctx.restore()
  }
}
