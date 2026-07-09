/**
 * The mechanism canvas — a smaller lit companion beside the sand hero.
 *
 * Planetary model (plan 0008, ADR 0020): N cogs roll inside the ring, each on
 * its own carrier and rigidly rotated by its phase, and each carries a single
 * marble (its pen). The mechanism is the honest picture of the "many pens"
 * garden — one gear + one marble per groove. It builds its cogs at the mech bowl
 * radius, so the marbles trace the same *shape* as the sand grooves at a smaller
 * *scale*. Owns its canvas + context; no React.
 *
 * `drawGear`/`drawRing` are ported verbatim from the Studio reference.
 */
import { gearPalette, fullTurns, shade } from '../engine/gears.ts'
import type { GardenConfig } from '../engine/state.ts'
import { clipCircle } from './sand.ts'

type Point = [number, number]

const TAU = Math.PI * 2

/** One cog's rolling geometry at the mech scale (rebuilt on config/resize). */
interface Cog {
  w: number
  carrierAmp: number
  a: number
  f: number
  cos: number
  sin: number
  tMax: number
}

export class MechRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private cssSize = 0
  private mechR = 0
  private scale = 1
  private cfg: GardenConfig | null = null
  private cogs: Cog[] = []
  /** Last-drawn marble points (mech canvas coords) — read via the test seam. */
  private lastMarbles: Point[] = []

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

  /** Cache the config and (re)build each cog's mech-scale rolling geometry. */
  setPattern(config: GardenConfig): void {
    this.cfg = config
    this.refit()
  }

  /** The last marble points drawn — the `.iwft` asserts per-cog coupling. */
  getMarbles(): Point[] {
    return this.lastMarbles
  }

  private refit(): void {
    if (!this.cfg || this.cssSize <= 0) return
    this.mechR = this.cssSize * 0.46
    const R = this.cfg.ring
    const d = this.cfg.offset
    const N = this.cfg.wheels.length
    this.scale = this.mechR / R
    this.cogs = this.cfg.wheels.map((w, i) => {
      const phase = (i * TAU) / N
      return {
        w,
        carrierAmp: R - w,
        a: d * w,
        f: (R - w) / w,
        cos: Math.cos(phase),
        sin: Math.sin(phase),
        tMax: TAU * fullTurns(R, [w]),
      }
    })
  }

  /** The wheel centre for cog `c` at wheel-angle `tt`, in canvas coords. */
  private wheelCentre(c: Cog, tt: number, cx: number, cy: number): Point {
    const x = c.carrierAmp * Math.cos(tt)
    const y = c.carrierAmp * Math.sin(tt)
    return [cx + (x * c.cos - y * c.sin) * this.scale, cy + (x * c.sin + y * c.cos) * this.scale]
  }

  /** The marble (pen) for cog `c` at wheel-angle `tt`, in canvas coords. */
  private marble(c: Cog, tt: number, cx: number, cy: number): Point {
    const x = c.carrierAmp * Math.cos(tt) + c.a * Math.cos(c.f * tt)
    const y = c.carrierAmp * Math.sin(tt) - c.a * Math.sin(c.f * tt)
    return [cx + (x * c.cos - y * c.sin) * this.scale, cy + (x * c.sin + y * c.cos) * this.scale]
  }

  /** Draw the ring and each cog (gear + spoke + marble) at carve `progress`. */
  draw(progress: number): void {
    const ctx = this.ctx
    const w = this.cssSize
    ctx.clearRect(0, 0, w, w)
    if (!this.cfg || this.cogs.length === 0) return
    const p = Math.max(0, Math.min(1, progress))
    const cx = w / 2
    const cy = w / 2
    ctx.save()
    clipCircle(ctx, w, w)
    this.drawRing(ctx, cx, cy, this.mechR, this.cfg.ring, '#8a5f37')

    const marbles: Point[] = []
    for (const c of this.cogs) {
      const tt = c.tMax * p
      const wc = this.wheelCentre(c, tt, cx, cy)
      const pen = this.marble(c, tt, cx, cy)
      const [, dark] = gearPalette(c.w)
      this.drawGear(ctx, wc[0], wc[1], c.w * this.scale, c.w, dark, -(this.cfg.ring / c.w) * tt)
      // Spoke from the wheel centre to its marble.
      ctx.beginPath()
      ctx.moveTo(wc[0], wc[1])
      ctx.lineTo(pen[0], pen[1])
      ctx.strokeStyle = 'rgba(255,220,170,.4)'
      ctx.lineWidth = 1.6
      ctx.lineCap = 'round'
      ctx.stroke()
      // The marble.
      const g = ctx.createRadialGradient(pen[0] - 1, pen[1] - 1, 0.4, pen[0], pen[1], 3.8)
      g.addColorStop(0, '#fff3d8')
      g.addColorStop(1, '#d9a24b')
      ctx.beginPath()
      ctx.arc(pen[0], pen[1], 3.4, 0, TAU)
      ctx.fillStyle = g
      ctx.fill()
      ctx.strokeStyle = 'rgba(30,18,6,.5)'
      ctx.lineWidth = 0.9
      ctx.stroke()
      marbles.push(pen)
    }
    this.lastMarbles = marbles
    ctx.restore()
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
