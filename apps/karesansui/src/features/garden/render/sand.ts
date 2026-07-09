/**
 * Pure sand-drawing helpers for the "many pens, one garden" model (plan 0008),
 * ported from the validated layout-spikes artifact. A flat single-colour bed
 * (D7), one groove per cog (shadow + highlight + core — no tines), a gold marble
 * at each groove's tip, and an optional clearing-rake wedge sweep. Each takes a
 * `CanvasRenderingContext2D` and draws in CSS-pixel coordinates; the caller owns
 * the DPR transform and the clip lifecycle. No React.
 */
type Point = [number, number]

const TAU = Math.PI * 2

/** Clip subsequent drawing to the circular sand bed inset 1px from the edge. */
export function clipCircle(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2)
  ctx.clip()
}

/**
 * The flat single-colour sand bed (D7) — a warm sand fill with a touch of radial
 * shading for depth only. Drawn large enough to cover the clip circle.
 */
export function gardenBed(ctx: CanvasRenderingContext2D, cx: number, cy: number, boardR: number): void {
  const bg = ctx.createRadialGradient(cx, cy - boardR * 0.2, boardR * 0.1, cx, cy, boardR * 1.06)
  bg.addColorStop(0, '#c89a5e')
  bg.addColorStop(1, '#8f6435')
  ctx.beginPath()
  ctx.arc(cx, cy, boardR * 1.12, 0, TAU)
  ctx.fillStyle = bg
  ctx.fill()
}

/**
 * One cog's groove, drawn from the start up to point index `upto` — three
 * offset strokes (shadow, highlight, core) so it reads as a carved single line.
 */
export function drawGroove(
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  upto: number,
  cx: number,
  cy: number,
): void {
  const stroke = (dx: number, dy: number, col: string, lw: number): void => {
    ctx.beginPath()
    for (let i = 0; i <= upto; i++) {
      const q = pts[i]
      if (!q) continue
      const x = q[0] + cx + dx
      const y = q[1] + cy + dy
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = col
    ctx.lineWidth = lw
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
  }
  stroke(0.7, 0.9, 'rgba(60,36,14,0.5)', 2.0) // groove shadow
  stroke(-0.5, -0.6, 'rgba(255,240,212,0.38)', 1.1) // groove highlight
  stroke(0, 0, 'rgba(60,36,14,0.4)', 0.8) // groove core
}

/** A single gold marble — one pen per cog, sitting at its groove's tip. */
export function drawMarble(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath()
  ctx.arc(x, y, 6.5, 0, TAU)
  ctx.fillStyle = 'rgba(255,235,190,.22)'
  ctx.fill()
  const g = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5)
  g.addColorStop(0, '#fff3d8')
  g.addColorStop(1, '#d9a24b')
  ctx.beginPath()
  ctx.arc(x, y, 4.6, 0, TAU)
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(30,18,6,.5)'
  ctx.lineWidth = 1
  ctx.stroke()
}

/**
 * The clearing rake (plan 0008 D4): a comb sweeping clockwise from the top,
 * wiping the bed smooth behind it. `sweep` ∈ [0, 1] is the fraction of a full
 * turn covered so far. Re-fills the swept wedge with fresh bed, then draws the
 * comb head at the leading edge. Caller has already drawn the full grooves.
 */
export function clearingSweep(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  boardR: number,
  sweep: number,
): void {
  const startA = -Math.PI / 2
  const endA = startA + sweep * TAU
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, boardR * 1.08, startA, endA)
  ctx.closePath()
  ctx.clip()
  gardenBed(ctx, cx, cy, boardR)
  ctx.restore()
  // The rake head at the leading edge.
  const ux = Math.cos(endA)
  const uy = Math.sin(endA)
  const px = -uy
  const py = ux
  const r0 = boardR * 0.05
  const r1 = boardR * 1.02
  ctx.beginPath()
  ctx.moveTo(cx + ux * r0, cy + uy * r0)
  ctx.lineTo(cx + ux * r1, cy + uy * r1)
  ctx.strokeStyle = 'rgba(40,24,8,.55)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,236,192,.5)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  for (let k = 0; k < 5; k++) {
    const rr = r0 + (r1 - r0) * (0.5 + k * 0.11)
    const bx = cx + ux * rr
    const by = cy + uy * rr
    ctx.beginPath()
    ctx.moveTo(bx - px * 5, by - py * 5)
    ctx.lineTo(bx + px * 5, by + py * 5)
    ctx.strokeStyle = 'rgba(40,24,8,.4)'
    ctx.lineWidth = 1.4
    ctx.stroke()
  }
}
