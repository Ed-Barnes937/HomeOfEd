import type { SimParams } from '../engine/params.ts'
import type { Simulation } from '../engine/simulation.ts'
import type { Theme } from '../themes.ts'

export type BoidShape = 'triangle' | 'dot' | 'line'

function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * A typed port of the design reference's `boids.js` `draw()`: gradient trail
 * streak behind each boid, direction from heading (`atan2(vy, vx)`), body
 * geometry per shape, glow via `shadowBlur`.
 */
export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.ctx = ctx
  }

  /** World size is CSS pixels; the canvas backing store scales by dpr. */
  resize(width: number, height: number, devicePixelRatio: number): void {
    this.width = width
    this.height = height
    this.canvas.width = width * devicePixelRatio
    this.canvas.height = height * devicePixelRatio
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  }

  draw(sim: Simulation, theme: Theme, shape: BoidShape, params: SimParams): void {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.fillStyle = theme.background
    ctx.fillRect(0, 0, this.width, this.height)

    const stroke = theme.drawMode === 'stroke'
    const palette = theme.palette
    const streak = 6 + params.trail * 46 + params.speed * 3

    for (const boid of sim.boids) {
      const angle = Math.atan2(boid.vy, boid.vx)
      const col = palette[boid.colorIndex % palette.length] ?? '#ffffff'
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)

      if (params.trail > 0.02) {
        this.drawTrail(boid.x, boid.y, dx, dy, streak, col, stroke, shape)
      }
      this.drawBody(boid.x, boid.y, angle, col, theme.glow, stroke, shape)
    }
    ctx.shadowBlur = 0
  }

  private drawTrail(
    x: number,
    y: number,
    dx: number,
    dy: number,
    streak: number,
    col: string,
    stroke: boolean,
    shape: BoidShape,
  ): void {
    const ctx = this.ctx
    const tx = x - dx * streak
    const ty = y - dy * streak
    const gradient = ctx.createLinearGradient(x, y, tx, ty)
    gradient.addColorStop(0, rgba(col, stroke ? 0.5 : 0.42))
    gradient.addColorStop(1, rgba(col, 0))
    ctx.strokeStyle = gradient
    ctx.lineWidth = shape === 'dot' ? 2.6 : 1.6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(tx, ty)
    ctx.stroke()
  }

  private drawBody(
    x: number,
    y: number,
    angle: number,
    col: string,
    glow: number,
    stroke: boolean,
    shape: BoidShape,
  ): void {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    if (glow > 0) {
      ctx.shadowBlur = glow
      ctx.shadowColor = col
    }
    if (stroke) {
      ctx.strokeStyle = col
      ctx.lineWidth = 1.4
    } else {
      ctx.fillStyle = col
    }

    if (shape === 'dot') {
      ctx.beginPath()
      ctx.arc(0, 0, 2.7, 0, Math.PI * 2)
      if (stroke) ctx.stroke()
      else ctx.fill()
    } else if (shape === 'line') {
      ctx.strokeStyle = col
      ctx.lineWidth = 1.8
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-5, 0)
      ctx.lineTo(6, 0)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(6, 0, stroke ? 1.5 : 2, 0, Math.PI * 2)
      ctx.fillStyle = col
      if (stroke) ctx.stroke()
      else ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(6.5, 0)
      ctx.lineTo(-5, 3.7)
      ctx.lineTo(-2.4, 0)
      ctx.lineTo(-5, -3.7)
      ctx.closePath()
      if (stroke) ctx.stroke()
      else ctx.fill()
    }
    ctx.restore()
  }
}
