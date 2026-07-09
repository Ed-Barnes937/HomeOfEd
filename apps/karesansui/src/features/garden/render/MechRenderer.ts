/**
 * The mechanism canvas — the illustrative gear cluster, ported verbatim from
 * the Studio reference's `drawRing`/`drawGear`/`drawMech`. It is decorative:
 * the cog layout does not share the pin formula with the sand geometry, they
 * sync only through the carrier angle `t`. Owns its canvas + context, no React.
 */
import { gearPalette, shade } from '../engine/gears.ts'
import { rakePresets } from '../engine/rake.ts'
import type { GardenConfig } from '../engine/state.ts'
import { clipCircle } from './sand.ts'

type Point = [number, number]

export class MechRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private cssSize = 0

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
  }

  /**
   * Draw the annulus, the auto-scaled cog cluster spun by the carrier angle
   * `carrierT`, the arm + pin, and the rake-head indicator (a marble for
   * single-tine rakes, a tine bar otherwise).
   */
  draw(config: GardenConfig, carrierT: number): void {
    const ctx = this.ctx
    const w = this.cssSize
    const h = this.cssSize
    const t = carrierT
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    clipCircle(ctx, w, h)
    const cx = w / 2
    const cy = h / 2
    const R = config.ring
    const W = config.wheels
    const outerR = w * 0.46
    const innerR = outerR * 0.82
    this.drawRing(ctx, cx, cy, outerR, R, '#8a5f37')

    // ---- abstract meshing layout (teeth = radius units) ----
    const dirs = [0, -Math.PI * 0.5] // fan directions for cog 2 and 3
    const rel: { x: number; y: number; pitch: number; teeth: number }[] = []
    let ax = 0
    let ay = 0
    for (let i = 0; i < W.length; i++) {
      const wi = W[i] ?? 0
      if (i > 0) {
        const d = (W[i - 1] ?? 0) + wi
        const ang = dirs[(i - 1) % dirs.length] ?? 0
        ax += d * Math.cos(ang)
        ay += d * Math.sin(ang)
      }
      rel.push({ x: ax, y: ay, pitch: wi, teeth: wi })
    }
    let mx = 0
    let my = 0
    rel.forEach((r) => {
      mx += r.x
      my += r.y
    })
    mx /= rel.length
    my /= rel.length
    let B = 1
    rel.forEach((r) => {
      B = Math.max(B, Math.hypot(r.x - mx, r.y - my) + r.pitch)
    })
    const fit = (innerR * 0.9) / B

    // spins for a rolling look
    const spins: number[] = []
    for (let i = 0; i < W.length; i++) {
      const wi = W[i] ?? 1
      spins.push(i === 0 ? -(R / (W[0] ?? 1)) * t : -(spins[i - 1] ?? 0) * ((W[i - 1] ?? 1) / wi))
    }

    // center cluster, rotate whole assembly by carrier t
    const chain = rel.map((r, i) => {
      const lx = (r.x - mx) * fit
      const ly = (r.y - my) * fit
      return {
        x: cx + lx * Math.cos(t) - ly * Math.sin(t),
        y: cy + lx * Math.sin(t) + ly * Math.cos(t),
        pitch: r.pitch * fit,
        spin: (spins[i] ?? 0) + t,
        teeth: r.teeth,
      }
    })

    // arms between meshing cogs
    ctx.strokeStyle = 'rgba(20,12,6,.42)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1]
      const cur = chain[i]
      if (!prev || !cur) continue
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(cur.x, cur.y)
      ctx.stroke()
    }

    // cogs
    for (const c of chain) {
      const col = gearPalette(c.teeth)
      this.drawGear(ctx, c.x, c.y, c.pitch, c.teeth, col[1], c.spin)
    }

    // pen pin on the last cog
    const lc = chain[chain.length - 1]
    if (!lc) {
      ctx.restore()
      return
    }
    const dir = lc.spin
    const pinx = lc.x + config.offset * lc.pitch * 0.82 * Math.cos(dir)
    const piny = lc.y + config.offset * lc.pitch * 0.82 * Math.sin(dir)

    // arm from cog to rake head
    ctx.beginPath()
    ctx.moveTo(lc.x, lc.y)
    ctx.lineTo(pinx, piny)
    ctx.strokeStyle = 'rgba(20,12,6,.5)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()

    // ---- rake-head indicator ----
    const tn = rakePresets()[config.rake].tines
    ctx.save()
    ctx.beginPath()
    ctx.arc(pinx, piny, 9, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(240,214,158,.16)'
    ctx.fill()
    ctx.restore()
    if (tn === 1) {
      // marble
      const g = ctx.createRadialGradient(pinx - 1.6, piny - 1.6, 0.6, pinx, piny, 5.2)
      g.addColorStop(0, '#fff8ea')
      g.addColorStop(1, '#c9a24b')
      ctx.beginPath()
      ctx.arc(pinx, piny, 5.2, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
      ctx.strokeStyle = '#241a10'
      ctx.lineWidth = 1.2
      ctx.stroke()
    } else {
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
      ctx.arc(pinx, piny, 2.4, 0, Math.PI * 2)
      ctx.fillStyle = '#e0b968'
      ctx.fill()
      ctx.strokeStyle = '#241a10'
      ctx.lineWidth = 1
      ctx.stroke()
    }
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
