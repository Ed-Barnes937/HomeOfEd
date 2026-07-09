/**
 * Pure sand-drawing helpers — ported verbatim from the Studio reference
 * (`sandFill`, `clipCircle`, `trace`, `emboss`, `rakeStyle`, `rakeSegment`).
 * Each takes a `CanvasRenderingContext2D` and draws in CSS-pixel coordinates;
 * the caller owns the DPR transform and the clip lifecycle. No React.
 *
 * `shade` is not redefined here — the engine owns it (`engine/gears.ts`).
 */
import type { RakePreset } from '../engine/rake.ts'

type Point = [number, number]

/** The three stroke colours + widths that make a carved groove read as embossed. */
export interface EmbossStyle {
  lw: number
  spread: number
  light: number
  groove: string
  shadow: string
  highlight: string
}

/** Radial sand gradient plus ~1400 speckle grains, filling the whole canvas. */
export function sandFill(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createRadialGradient(w * 0.42, h * 0.4, w * 0.1, w * 0.5, h * 0.5, w * 0.72)
  g.addColorStop(0, '#efe0bd')
  g.addColorStop(1, '#d3b787')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.045)' : 'rgba(90,66,36,.05)'
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.3, 1.3)
  }
}

/** Clip subsequent drawing to the circular sand bed inset 1px from the edge. */
export function clipCircle(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2)
  ctx.clip()
}

/** Append a polyline (offset by `ox,oy`, centred at `cx,cy`) to the current path. */
export function trace(
  ctx: CanvasRenderingContext2D,
  line: Point[],
  ox: number,
  oy: number,
  cx: number,
  cy: number,
): void {
  let started = false
  for (const p of line) {
    const x = p[0] + cx + ox
    const y = p[1] + cy + oy
    if (started) ctx.lineTo(x, y)
    else {
      ctx.moveTo(x, y)
      started = true
    }
  }
}

/** Draw one groove as shadow + highlight + groove strokes for a carved look. */
export function emboss(
  ctx: CanvasRenderingContext2D,
  line: Point[],
  o: EmbossStyle,
  cx: number,
  cy: number,
): void {
  const L = o.light
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  trace(ctx, line, L, L, cx, cy)
  ctx.strokeStyle = o.shadow
  ctx.lineWidth = o.lw + o.spread
  ctx.stroke()
  ctx.beginPath()
  trace(ctx, line, -L * 0.7, -L * 0.7, cx, cy)
  ctx.strokeStyle = o.highlight
  ctx.lineWidth = o.lw * 0.72
  ctx.stroke()
  ctx.beginPath()
  trace(ctx, line, 0, 0, cx, cy)
  ctx.strokeStyle = o.groove
  ctx.lineWidth = o.lw
  ctx.stroke()
}

/** Emboss colours for a rake preset — the fixed groove/shadow/highlight tones. */
export function rakeStyle(rake: RakePreset): EmbossStyle {
  return {
    lw: rake.lw,
    spread: rake.spread,
    light: rake.light,
    groove: 'rgba(118,90,52,.86)',
    shadow: 'rgba(90,64,32,.34)',
    highlight: 'rgba(255,249,233,.62)',
  }
}

/**
 * Carve the pattern between point indices `a..b` with the rake's `tines`
 * fingers, each offset along the per-point normal by `(t - half) * spacing`.
 * Starts one point before `a` so consecutive segments join seamlessly.
 */
export function rakeSegment(
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  norm: Point[],
  rake: RakePreset,
  a: number,
  b: number,
  cx: number,
  cy: number,
): void {
  const o = rakeStyle(rake)
  const half = (rake.tines - 1) / 2
  const s = Math.max(0, a - 1)
  for (let t = 0; t < rake.tines; t++) {
    const off = (t - half) * rake.spacing
    const line: Point[] = []
    for (let i = s; i <= b; i++) {
      const p = pts[i]
      const nrm = norm[i]
      if (!p || !nrm) continue
      line.push([p[0] + nrm[0] * off, p[1] + nrm[1] * off])
    }
    emboss(ctx, line, o, cx, cy)
  }
}
