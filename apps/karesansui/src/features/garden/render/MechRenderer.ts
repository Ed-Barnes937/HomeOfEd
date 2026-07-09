/**
 * The mechanism canvas — a smaller lit companion beside the sand hero.
 *
 * Level-2 pen-fidelity (ADR 0018 amended, plan 0007 D4): the pen always sits on
 * the *true* `geom()` point, so it visibly leads the same curve the sand carves.
 *  - **1 cog** → an honest single-wheel spirograph: a wheel of radius `W0` at the
 *    real carrier position `(R−W0)·(cos t, sin t)`, spun by `−(R/W0)·t`, with the
 *    pen pinned at the geom point (which, for one wheel, lies on that wheel).
 *  - **2–3 cogs** → an honest epicycle arm-chain: `geom()` is a carrier plus one
 *    rotating term per wheel, so the mechanism is that same chain of arms with a
 *    pivot cog at each stage and the pen at the tip of the last arm — the pen is
 *    genuinely the end of the visible mechanism, not a point drawn beside it.
 *
 * The mechanism owns its own `geom()` fit to its bowl radius, so the pen path
 * fills the mech bowl — same *shape* as the sand groove, different *size*. Owns
 * its canvas + context; no React.
 */
import { geom, type Geom } from '../engine/geom.ts'
import { gearPalette, shade } from '../engine/gears.ts'
import { rakePresets } from '../engine/rake.ts'
import type { GardenConfig } from '../engine/state.ts'
import { clipCircle } from './sand.ts'

type Point = [number, number]

const TAU = Math.PI * 2

export class MechRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private cssSize = 0
  private mechR = 0
  private penBoardR = 0
  private cfg: GardenConfig | null = null
  private penGeom: Geom | null = null
  /** Last-drawn pen point (mech canvas coords) — read via the test seam. */
  private lastPen: Point = [0, 0]

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.canvas = canvas
    this.ctx = ctx
  }

  /** Rebuild the backing store for a square `cssSize`; DPR capped at 2. */
  resize(cssSize: number, dpr: number): void {
    const d = Math.min(dpr, 2)
    this.cssSize = cssSize
    this.canvas.width = Math.round(cssSize * d)
    this.canvas.height = Math.round(cssSize * d)
    this.ctx.setTransform(d, 0, 0, d, 0, 0)
    this.refit()
  }

  /** Cache the config and (re)build the mech-scale pen path. */
  setPattern(config: GardenConfig): void {
    this.cfg = config
    this.refit()
  }

  /** The last pen point drawn, for the `.iwft` to assert the mech tracks the carve. */
  getPenPoint(): Point {
    return this.lastPen
  }

  private refit(): void {
    if (!this.cfg || this.cssSize <= 0) return
    this.mechR = this.cssSize * 0.46
    // Fit the pen path comfortably inside the ring's inner radius (0.82·mechR).
    this.penBoardR = this.mechR * 0.8
    this.penGeom = geom(this.cfg, this.penBoardR)
  }

  /**
   * Draw the ring, the ghost + active pen path, the gear(s), and the arm + pen
   * (with the rake-head indicator) at carve `progress` ∈ [0, 1].
   */
  draw(progress: number): void {
    const ctx = this.ctx
    const w = this.cssSize
    ctx.clearRect(0, 0, w, w)
    if (!this.cfg || !this.penGeom || this.penGeom.pts.length === 0) return
    const p = Math.max(0, Math.min(1, progress))
    ctx.save()
    clipCircle(ctx, w, w)
    const cx = w / 2
    const cy = w / 2

    this.drawRing(ctx, cx, cy, this.mechR, this.cfg.ring, '#8a5f37')
    this.drawPenPath(ctx, cx, cy, p)

    if (this.cfg.wheels.length === 1) {
      const pen = this.penPointAt(p)
      this.lastPen = pen
      const origin = this.drawSingleWheel(ctx, cx, cy, p)
      this.drawArmAndPen(ctx, origin, pen)
    } else {
      this.lastPen = this.drawArmChain(ctx, cx, cy, p)
    }

    ctx.restore()
  }

  /** The true geom pen point at progress `p`, in canvas coords. */
  private penPointAt(p: number): Point {
    const pts = this.penGeom?.pts ?? []
    const idx = Math.max(0, Math.min(pts.length - 1, Math.round(p * (pts.length - 1))))
    const q = pts[idx] ?? [0, 0]
    return [this.cssSize / 2 + q[0], this.cssSize / 2 + q[1]]
  }

  /** Faint full pen path (ghost) + the amber active path up to `p`. */
  private drawPenPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, p: number): void {
    const pts = this.penGeom?.pts ?? []
    ctx.beginPath()
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i] ?? [0, 0]
      if (i === 0) ctx.moveTo(cx + q[0], cy + q[1])
      else ctx.lineTo(cx + q[0], cy + q[1])
    }
    ctx.strokeStyle = 'rgba(230,180,92,0.13)'
    ctx.lineWidth = 1
    ctx.stroke()

    const upto = Math.max(1, Math.round(p * (pts.length - 1)))
    ctx.beginPath()
    for (let i = 0; i <= upto; i++) {
      const q = pts[i] ?? [0, 0]
      if (i === 0) ctx.moveTo(cx + q[0], cy + q[1])
      else ctx.lineTo(cx + q[0], cy + q[1])
    }
    ctx.strokeStyle = 'rgba(230,180,92,0.5)'
    ctx.lineWidth = 1.3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  /**
   * One rolling wheel at the real carrier position, on the same scale as the pen
   * path (so the pen sits on its rim). Returns the wheel centre for the arm.
   */
  private drawSingleWheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, p: number): Point {
    const cfg = this.cfg
    const geomC = this.penGeom
    if (!cfg || !geomC) return [cx, cy]
    const R = cfg.ring
    const W0 = cfg.wheels[0] ?? 1
    const carrierAmp = R - W0
    const a = cfg.offset * W0
    // geom() scaled `raw / (maxReach·1.03)`; for one wheel maxReach = carrierAmp+a
    // (at t=0), so this is exactly the scale it used — wheel + pen stay aligned.
    const scale = this.penBoardR / ((carrierAmp + a) * 1.03)
    const t = geomC.tMax * p
    const wx = cx + carrierAmp * scale * Math.cos(t)
    const wy = cy + carrierAmp * scale * Math.sin(t)
    const wheelR = W0 * scale
    const [, dark] = gearPalette(W0)
    this.drawGear(ctx, wx, wy, wheelR, W0, dark, -(R / W0) * t)
    return [wx, wy]
  }

  /**
   * The honest epicycle arm-chain for 2–3 cogs. `geom()` is a sum of rotating
   * vectors — a carrier plus one term per wheel — so the mechanism that draws it
   * is that same chain of arms: wheel 0 rolls in the ring, and each further wheel
   * adds a term whose pivot sits on the tip of the one before. The pen rides the
   * tip of the last arm, so it is genuinely the end of the visible mechanism (no
   * cheat arm to a separate point). Uses `geom()`'s own fit `scale`, so the pen
   * lands exactly on the drawn pen path. Returns the pen point.
   */
  private drawArmChain(ctx: CanvasRenderingContext2D, cx: number, cy: number, p: number): Point {
    const cfg = this.cfg
    const geomC = this.penGeom
    if (!cfg || !geomC) return [cx, cy]
    const scale = geomC.scale
    const R = cfg.ring
    const W = cfg.wheels
    const d = cfg.offset
    const t = geomC.tMax * p

    // Carrier arm: swings wheel 0 around inside the ring.
    const W0 = W[0] ?? 1
    let jx = cx + (R - W0) * scale * Math.cos(t)
    let jy = cy + (R - W0) * scale * Math.sin(t)
    this.drawArm(ctx, cx, cy, jx, jy)
    const [, dark0] = gearPalette(W0)
    this.drawGear(ctx, jx, jy, W0 * scale, W0, dark0, -(R / W0) * t)

    // Each wheel adds one term (amplitude d·Wᵢ·0.56ⁱ, frequency ±(R−Wᵢ)/Wᵢ),
    // matching geom() verbatim; term i pivots on the tip of term i−1.
    let prevx = jx
    let prevy = jy
    for (let i = 0; i < W.length; i++) {
      const wi = W[i] ?? 1
      const f = ((R - wi) / wi) * (i % 2 === 0 ? 1 : -1)
      const a = d * wi * Math.pow(0.56, i) * scale
      // Stages after the first show a small pivot cog on the previous tip, so the
      // chain reads as connected gearing rather than free-floating arms.
      if (i >= 1) {
        const [, dark] = gearPalette(wi)
        this.drawGear(ctx, jx, jy, Math.max(a, 7), wi, dark, f * t)
      }
      const nx = jx + a * Math.cos(f * t)
      const ny = jy - a * Math.sin(f * t)
      this.drawArm(ctx, jx, jy, nx, ny)
      prevx = jx
      prevy = jy
      jx = nx
      jy = ny
    }

    const pen: Point = [jx, jy]
    this.drawRakeHead(ctx, pen[0], pen[1], Math.atan2(jy - prevy, jx - prevx))
    return pen
  }

  /** A single amber mechanism arm between two joints. */
  private drawArm(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.strokeStyle = 'rgba(255,220,170,0.45)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  /** Arm from the driving cog to the true pen point, then the rake-head glyph. */
  private drawArmAndPen(ctx: CanvasRenderingContext2D, origin: Point, pen: Point): void {
    this.drawArm(ctx, origin[0], origin[1], pen[0], pen[1])
    const dir = Math.atan2(pen[1] - origin[1], pen[0] - origin[0])
    this.drawRakeHead(ctx, pen[0], pen[1], dir)
  }

  /** The rake-head indicator at the pen — a marble dot or a tine bar (ported). */
  private drawRakeHead(ctx: CanvasRenderingContext2D, pinx: number, piny: number, dir: number): void {
    const tn = rakePresets()[this.cfg?.rake ?? 'wide'].tines
    ctx.save()
    ctx.beginPath()
    ctx.arc(pinx, piny, 9, 0, TAU)
    ctx.fillStyle = 'rgba(240,214,158,.16)'
    ctx.fill()
    ctx.restore()
    if (tn === 1) {
      const g = ctx.createRadialGradient(pinx - 1.6, piny - 1.6, 0.6, pinx, piny, 5.2)
      g.addColorStop(0, '#fff8ea')
      g.addColorStop(1, '#e6b45c')
      ctx.beginPath()
      ctx.arc(pinx, piny, 5.2, 0, TAU)
      ctx.fillStyle = g
      ctx.fill()
      ctx.strokeStyle = '#241a10'
      ctx.lineWidth = 1.2
      ctx.stroke()
      return
    }
    const showN = Math.min(tn, 5)
    const bx = Math.cos(dir + Math.PI / 2)
    const by = Math.sin(dir + Math.PI / 2)
    const tx = Math.cos(dir)
    const ty = Math.sin(dir)
    const barL = 5 + showN * 3.1
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(pinx - (bx * barL) / 2, piny - (by * barL) / 2)
    ctx.lineTo(pinx + (bx * barL) / 2, piny + (by * barL) / 2)
    ctx.strokeStyle = '#241a10'
    ctx.lineWidth = 3.6
    ctx.stroke()
    ctx.strokeStyle = '#f4e6c6'
    ctx.lineWidth = 1.9
    ctx.stroke()
    for (let i = 0; i < showN; i++) {
      const f = showN === 1 ? 0 : i / (showN - 1) - 0.5
      const ox = pinx + bx * barL * f
      const oy = piny + by * barL * f
      ctx.beginPath()
      ctx.moveTo(ox, oy)
      ctx.lineTo(ox + tx * 4.6, oy + ty * 4.6)
      ctx.strokeStyle = '#241a10'
      ctx.lineWidth = 2.4
      ctx.stroke()
      ctx.strokeStyle = '#e0b968'
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(pinx, piny, 2.4, 0, TAU)
    ctx.fillStyle = '#e0b968'
    ctx.fill()
    ctx.strokeStyle = '#241a10'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  /** One meshing cog: toothed rim, radial-gradient fill, hub, bolt holes, bore. */
  private drawGear(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    R: number,
    teeth: number,
    color: string,
    rot: number,
  ): void {
    const td = R * 0.16
    const inner = R - td
    const hub = inner * 0.5
    const bore = inner * 0.18
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rot)
    ctx.beginPath()
    const u = (Math.PI * 2) / teeth
    for (let i = 0; i < teeth; i++) {
      const b = i * u
      const p: Point[] = [
        [inner, b],
        [R, b + u * 0.16],
        [R, b + u * 0.34],
        [inner, b + u * 0.5],
        [inner, b + u],
      ]
      for (const [kk, seg] of p.entries()) {
        const x = Math.cos(seg[1]) * seg[0]
        const y = Math.sin(seg[1]) * seg[0]
        if (i === 0 && kk === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
    }
    ctx.closePath()
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R)
    g.addColorStop(0, shade(color, 34))
    g.addColorStop(0.6, color)
    g.addColorStop(1, shade(color, -34))
    ctx.fillStyle = g
    ctx.fill()
    ctx.lineWidth = R * 0.03
    ctx.strokeStyle = shade(color, -55)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, hub, 0, Math.PI * 2)
    ctx.fillStyle = shade(color, -20)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,.25)'
    ctx.lineWidth = 1.1
    ctx.stroke()
    const holes = Math.max(4, Math.round(teeth / 9))
    for (let i = 0; i < holes; i++) {
      const a = (i / holes) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(Math.cos(a) * hub * 0.6, Math.sin(a) * hub * 0.6, hub * 0.17, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,.2)'
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(0, 0, bore, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(20,12,6,.55)'
    ctx.fill()
    ctx.restore()
  }

  /** The static outer annulus with inward-facing teeth. */
  private drawRing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    outerR: number,
    teeth: number,
    color: string,
  ): void {
    const innerR = outerR * 0.82
    ctx.save()
    ctx.translate(cx, cy)
    ctx.beginPath()
    ctx.arc(0, 0, outerR, 0, Math.PI * 2)
    ctx.arc(0, 0, innerR, 0, Math.PI * 2, true)
    const g = ctx.createRadialGradient(-outerR * 0.3, -outerR * 0.3, innerR, 0, 0, outerR)
    g.addColorStop(0, shade(color, 26))
    g.addColorStop(1, shade(color, -30))
    ctx.fillStyle = g
    ctx.fill('evenodd')
    ctx.lineWidth = 1.2
    ctx.strokeStyle = 'rgba(0,0,0,.28)'
    ctx.beginPath()
    ctx.arc(0, 0, outerR, 0, Math.PI * 2)
    ctx.stroke()
    const u = (Math.PI * 2) / teeth
    const td = outerR * 0.055
    ctx.fillStyle = shade(color, -42)
    for (let i = 0; i < teeth; i++) {
      const a = i * u
      ctx.beginPath()
      const pts: Point[] = [
        [innerR, a - u * 0.28],
        [innerR, a + u * 0.28],
        [innerR - td, a + u * 0.16],
        [innerR - td, a - u * 0.16],
      ]
      for (const [kk, seg] of pts.entries()) {
        const x = Math.cos(seg[1]) * seg[0]
        const y = Math.sin(seg[1]) * seg[0]
        if (kk === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
}
