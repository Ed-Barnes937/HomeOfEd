/**
 * The projection layer (spec §6). The ONLY module in the render/engine layers
 * allowed to touch a `CanvasRenderingContext2D`. It projects an `Op[]` onto the
 * canvas under the current contain-fit, drawing the blot/stroke/eye primitives.
 *
 * The blot outline (midpoint-quadratic closed fill) and eye geometry are ported
 * from the design guide's `drawBlob`/`stampEye` — the maths, not the file. Every
 * op already stores RESOLVED geometry (rolled once at creation), so replay is
 * deterministic; this module re-rolls nothing.
 *
 * Blots render with a soft watercolour tone (translucent bleed rings + a
 * radial-gradient core) and bloom in via `phase` — the ink-in-water entrance
 * whose pure maths live in `diffusion.ts`. Tone opacity rides in the fill
 * colours (rgba), never `globalAlpha`, so `globalAlpha` is used solely for the
 * entrance fade.
 */
import type { Fit } from '../engine/coords.ts'
import { computeFit } from '../engine/coords.ts'
import { currentViewBox, visibleOps } from '../engine/history.ts'
import type { Blot, Eye, Op, Point, Stroke } from '../engine/types.ts'
import type { SketchbookTheme } from '../theme.ts'
import { blotProgress, growScale, layerAlpha } from './diffusion.ts'

const TAU = Math.PI * 2

/** Translucent bleed halo around each blot, outermost first (watercolour edge). */
const BLEED_RINGS = [
  { scale: 1.3, alpha: 0.05 },
  { scale: 1.15, alpha: 0.1 },
]

/** Radial-gradient core: solid interior easing to a slightly softer edge. */
const CORE_EDGE_ALPHA = 0.8

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

export class DoodleSurface {
  private readonly ctx: CanvasRenderingContext2D
  private cssW = 0
  private cssH = 0
  /** Backing-store scale = min(dpr, 2). */
  private scale = 1

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.ctx = ctx
  }

  /** Size the backing store to css size × min(dpr, 2). */
  resize(cssW: number, cssH: number, dpr: number): void {
    const scale = Math.min(dpr, 2)
    this.cssW = cssW
    this.cssH = cssH
    this.scale = scale
    this.canvas.width = Math.round(cssW * scale)
    this.canvas.height = Math.round(cssH * scale)
  }

  /** Paint paper over the FULL device rect (art bleeds under it are cleared). */
  paintPaper(color: string): void {
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /**
   * Full projection: paint paper, then replay the visible ops within the fit.
   * `phase` is the ink-in-water entrance progress (0 = nothing, 1 = settled);
   * only `field` blots animate, so strokes/eyes always draw fully opaque.
   */
  renderOps(ops: readonly Op[], theme: SketchbookTheme, phase = 1): void {
    const ctx = this.ctx
    this.paintPaper(theme.paper)

    const fit = computeFit(currentViewBox(ops), this.cssW, this.cssH)
    this.applyFit(fit)

    for (const op of visibleOps(ops)) {
      if (op.type === 'field') {
        op.blots.forEach((blot, i) => this.drawBlot(blot, theme, blotProgress(phase, i, op.blots.length)))
      } else if (op.type === 'stroke') {
        this.drawStroke(op.stroke)
      } else {
        this.drawEye(op.eye, theme)
      }
    }

    ctx.globalAlpha = 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  /**
   * Live-drawing fast path: stroke ONE new segment (last→current) without a full
   * re-render. Coords are logical; the surface applies the current fit.
   */
  drawLiveSegment(from: Point, to: Point, color: string, width: number, fit: Fit): void {
    const ctx = this.ctx
    this.applyFit(fit)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  /** Set the CTM to (backing-store scale) × (contain fit). */
  private applyFit(fit: Fit): void {
    const s = this.scale
    this.ctx.setTransform(s * fit.scale, 0, 0, s * fit.scale, s * fit.offsetX, s * fit.offsetY)
  }

  /** Trace the midpoint-quadratic closed outline through `pts`. */
  private traceOutline(pts: Point[]): void {
    const ctx = this.ctx
    const n = pts.length
    const start = midpoint(pts[n - 1]!, pts[0]!)
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    for (let i = 0; i < n; i++) {
      const cur = pts[i]!
      const next = pts[(i + 1) % n]!
      const m = midpoint(cur, next)
      ctx.quadraticCurveTo(cur.x, cur.y, m.x, m.y)
    }
    ctx.closePath()
  }

  /**
   * Watercolour blot: translucent bleed rings, then a radial-gradient core, plus
   * satellite droplets — all grown from a seed and faded in per `localPhase`
   * (the ink-in-water entrance). Tone opacity lives in the fill colours; the
   * only `globalAlpha` write is the entrance fade.
   */
  private drawBlot(blot: Blot, theme: SketchbookTheme, localPhase: number): void {
    const ctx = this.ctx
    const pts = blot.points
    if (pts.length < 2) return

    const { cx, cy, r } = blot
    const grow = growScale(localPhase)
    const [ri, gi, bi] = hexToRgb(theme.ink)
    const rgba = (a: number): string => `rgba(${ri}, ${gi}, ${bi}, ${a})`
    const scaled = (k: number): Point[] =>
      pts.map((p) => ({ x: cx + (p.x - cx) * grow * k, y: cy + (p.y - cy) * grow * k }))

    ctx.globalAlpha = layerAlpha(localPhase)

    // Soft bleed halo (outermost, faintest first).
    for (const ring of BLEED_RINGS) {
      this.traceOutline(scaled(ring.scale))
      ctx.fillStyle = rgba(ring.alpha)
      ctx.fill()
    }

    // Radial-gradient core: solid interior, gently softer edge.
    const coreR = Math.max(r * grow, 0.01)
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR)
    gradient.addColorStop(0, rgba(1))
    gradient.addColorStop(0.65, rgba(1))
    gradient.addColorStop(1, rgba(CORE_EDGE_ALPHA))
    this.traceOutline(scaled(1))
    ctx.fillStyle = gradient
    ctx.fill()

    // Satellite droplets — flung out and grown with the body.
    for (const sat of blot.satellites) {
      const sx = cx + (sat.x - cx) * grow
      const sy = cy + (sat.y - cy) * grow
      ctx.beginPath()
      ctx.arc(sx, sy, sat.r * grow, 0, TAU)
      ctx.fillStyle = rgba(1)
      ctx.fill()
    }

    ctx.globalAlpha = 1
  }

  /** Round-capped/joined polyline; a single-point stroke renders a round dot. */
  private drawStroke(stroke: Stroke): void {
    const ctx = this.ctx
    const pts = stroke.points
    if (pts.length === 0) return
    ctx.globalAlpha = 1
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[0]!.x, pts[0]!.y)
    if (pts.length === 1) {
      ctx.lineTo(pts[0]!.x, pts[0]!.y)
    } else {
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
    }
    ctx.stroke()
  }

  /** White circle + stroke, pupil offset along gaze, white highlight (§5.4). */
  private drawEye(eye: Eye, theme: SketchbookTheme): void {
    const ctx = this.ctx
    const { x, y, size: s, pupilAngle } = eye
    ctx.globalAlpha = 1

    ctx.beginPath()
    ctx.arc(x, y, s, 0, TAU)
    ctx.fillStyle = theme.eyeWhite
    ctx.fill()
    ctx.lineWidth = Math.max(1, s * 0.14)
    ctx.strokeStyle = theme.eyeStroke
    ctx.stroke()

    const pd = s * 0.3
    const px = x + Math.cos(pupilAngle) * pd
    const py = y + Math.sin(pupilAngle) * pd
    ctx.beginPath()
    ctx.arc(px, py, s * 0.55, 0, TAU)
    ctx.fillStyle = theme.eyeStroke
    ctx.fill()

    ctx.beginPath()
    ctx.arc(px - s * 0.2, py - s * 0.2, s * 0.17, 0, TAU)
    ctx.fillStyle = theme.eyeWhite
    ctx.fill()
  }
}
