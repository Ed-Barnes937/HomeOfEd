import type { SimParams } from '../engine/params.ts'
import type { Simulation } from '../engine/simulation.ts'
import type { Theme } from '../themes.ts'
import { generateStars } from './backdrop.ts'
import { KeyedColourCache } from './spriteCache.ts'

export type BoidShape = 'triangle' | 'dot' | 'line' | 'rocket' | 'duck'

/** Trail streak length in px — the reference's `6 + trail*46 + speed*3`. */
export function streakLength(params: SimParams): number {
  return 6 + params.trail * 46 + params.speed * 3
}

function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Body geometry at the origin, +x = heading — the caller owns the transform.
 * Byte-for-byte the reference's shape drawing, minus the shadow (glow themes
 * get their glow from a pre-rendered sprite instead, see buildGlowSprite).
 */
function drawShapeAtOrigin(
  ctx: CanvasRenderingContext2D,
  shape: BoidShape,
  col: string,
  stroke: boolean,
): void {
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
  } else if (shape === 'rocket') {
    // Hull pointing +x (nose at x=8), two swept fins at the tail.
    ctx.beginPath()
    ctx.moveTo(8, 0)
    ctx.lineTo(2.5, 2.6)
    ctx.lineTo(-4, 2.6)
    ctx.lineTo(-4, -2.6)
    ctx.lineTo(2.5, -2.6)
    ctx.closePath()
    ctx.moveTo(-4, 2.6)
    ctx.lineTo(-7.5, 5)
    ctx.lineTo(-4, 0.6)
    ctx.moveTo(-4, -2.6)
    ctx.lineTo(-7.5, -5)
    ctx.lineTo(-4, -0.6)
    if (stroke) ctx.stroke()
    else ctx.fill()
  } else if (shape === 'duck') {
    // Body + head + beak silhouette, facing +x.
    ctx.beginPath()
    ctx.ellipse(-1.5, 1, 5.5, 3.6, 0, 0, Math.PI * 2)
    ctx.moveTo(6.6, -2.2)
    ctx.arc(4.2, -2.2, 2.4, 0, Math.PI * 2)
    ctx.moveTo(6.2, -2.8)
    ctx.lineTo(9.2, -1.8)
    ctx.lineTo(6.2, -1)
    ctx.closePath()
    ctx.moveTo(-6.5, 0.4)
    ctx.lineTo(-8.2, -1.6)
    ctx.lineTo(-5.5, -0.4)
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
}

interface GlowSprite {
  canvas: HTMLCanvasElement
  /** Sprite square edge in CSS px; drawn centred on the boid. */
  size: number
}

/** Every body shape fits inside this radius (line tip reaches x=8). */
const BODY_RADIUS = 10
/** Sprites render at 2× the backing resolution so the rotated blit stays crisp. */
const SUPERSAMPLE = 2

/**
 * Pre-render one glowing boid body. Canvas shadows blur in backing-store
 * pixels regardless of the CTM, so the sprite uses shadowBlur = glow ×
 * SUPERSAMPLE; the blit downscales by SUPERSAMPLE, landing the glow at
 * exactly `glow` backing px — identical to the per-boid shadowBlur it
 * replaces.
 */
function buildGlowSprite(
  col: string,
  shape: BoidShape,
  glow: number,
  stroke: boolean,
  dpr: number,
): GlowSprite {
  // Pad = the blur's support: sigma is shadowBlur/2, so the glow is gone by
  // ~3 sigma = 1.5 × glow past the body silhouette (which BODY_RADIUS already
  // covers). The blended quad area is the renderer's dominant cost on
  // software-rasterised canvases — keep the quad tight.
  const size = Math.ceil(2 * (BODY_RADIUS + 1.5 * glow))
  const scale = dpr * SUPERSAMPLE
  const canvas = document.createElement('canvas')
  canvas.width = size * scale
  canvas.height = size * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.setTransform(scale, 0, 0, scale, (size / 2) * scale, (size / 2) * scale)
  ctx.shadowBlur = glow * SUPERSAMPLE
  ctx.shadowColor = col
  drawShapeAtOrigin(ctx, shape, col, stroke)
  return { canvas, size }
}

/**
 * A typed port of the design reference's `boids.js` `draw()`: gradient trail
 * streak behind each boid, direction from heading (`atan2(vy, vx)`), body
 * geometry per shape, glow at the theme's shadowBlur value.
 *
 * Perf shape (for count up to 1000): glow comes from per-colour sprites and
 * trail gradients are built per colour in boid-local space, so the per-boid
 * work is one setTransform + one stroke + one drawImage/fill — no
 * per-boid shadowBlur or gradient allocation. Caches invalidate on
 * theme/shape/dpr/streak change (KeyedColourCache).
 */
export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private dpr = 1
  private readonly glowSprites = new KeyedColourCache<GlowSprite>()
  private readonly trailGradients = new KeyedColourCache<CanvasGradient>()
  private starfield: { key: string; canvas: HTMLCanvasElement } | null = null

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.ctx = ctx
  }

  /** World size is CSS pixels; the canvas backing store scales by dpr. */
  resize(width: number, height: number, devicePixelRatio: number): void {
    this.width = width
    this.height = height
    this.dpr = devicePixelRatio
    this.canvas.width = width * devicePixelRatio
    this.canvas.height = height * devicePixelRatio
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  }

  draw(sim: Simulation, theme: Theme, shape: BoidShape, params: SimParams): void {
    const ctx = this.ctx
    const dpr = this.dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    this.paintBackground(theme)

    const stroke = theme.drawMode === 'stroke'
    const palette = theme.palette
    const streak = streakLength(params)
    const drawTrails = params.trail > 0.02

    const gradients = drawTrails
      ? this.trailGradients.get(`${theme.id}|${stroke}|${streak}`, palette, (col) =>
          this.buildTrailGradient(col, stroke, streak),
        )
      : []
    const sprites =
      theme.glow > 0
        ? this.glowSprites.get(`${theme.id}|${shape}|${dpr}`, palette, (col) =>
            buildGlowSprite(col, shape, theme.glow, stroke, dpr),
          )
        : []

    const trailWidth = shape === 'dot' ? 2.6 : 1.6

    for (const boid of sim.boids) {
      const angle = Math.atan2(boid.vy, boid.vx)
      const ci = boid.colorIndex % palette.length
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      // Boid-local frame: origin at the boid, +x = heading, dpr-scaled.
      ctx.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * boid.x, dpr * boid.y)

      if (drawTrails) {
        // Width/cap set per boid — drawShapeAtOrigin mutates them for some shapes.
        ctx.strokeStyle = gradients[ci] ?? '#ffffff'
        ctx.lineWidth = trailWidth
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(-streak, 0)
        ctx.stroke()
      }

      const sprite = sprites[ci]
      if (sprite) {
        ctx.drawImage(sprite.canvas, -sprite.size / 2, -sprite.size / 2, sprite.size, sprite.size)
      } else {
        drawShapeAtOrigin(ctx, shape, palette[ci] ?? '#ffffff', stroke)
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /**
   * The reference's per-boid world-space gradient, hoisted: built in
   * boid-local space (origin → tail at −streak), so one gradient per palette
   * colour serves every boid via the per-boid transform.
   */
  private buildTrailGradient(col: string, stroke: boolean, streak: number): CanvasGradient {
    const gradient = this.ctx.createLinearGradient(0, 0, -streak, 0)
    gradient.addColorStop(0, rgba(col, stroke ? 0.5 : 0.42))
    gradient.addColorStop(1, rgba(col, 0))
    return gradient
  }

  /**
   * Fill the frame: a flat `background`, a vertical gradient down to
   * `backdrop.to`, or the flat fill plus a cached static starfield.
   * Runs under the dpr transform, so coordinates are CSS px.
   */
  private paintBackground(theme: Theme): void {
    const ctx = this.ctx
    const backdrop = theme.backdrop
    if (backdrop?.kind === 'gradient') {
      const gradient = ctx.createLinearGradient(0, 0, 0, this.height)
      gradient.addColorStop(0, theme.background)
      gradient.addColorStop(1, backdrop.to)
      ctx.fillStyle = gradient
    } else {
      ctx.fillStyle = theme.background
    }
    ctx.fillRect(0, 0, this.width, this.height)

    if (backdrop?.kind === 'stars') {
      ctx.drawImage(this.starfieldCanvas(theme.id), 0, 0, this.width, this.height)
    }
  }

  /**
   * A transparent overlay of stars, pre-rendered at backing resolution and
   * cached until the theme or viewport changes — the field is static, so this
   * is one drawImage per frame rather than hundreds of arcs.
   */
  private starfieldCanvas(themeId: string): HTMLCanvasElement {
    const key = `${themeId}|${this.width}x${this.height}|${this.dpr}`
    if (this.starfield?.key === key) return this.starfield.canvas

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(this.width * this.dpr))
    canvas.height = Math.max(1, Math.round(this.height * this.dpr))
    const sctx = canvas.getContext('2d')
    if (!sctx) throw new Error('2D canvas context unavailable')
    sctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    sctx.fillStyle = '#ffffff'
    for (const star of generateStars(this.width, this.height)) {
      sctx.globalAlpha = star.a
      sctx.beginPath()
      sctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
      sctx.fill()
    }
    this.starfield = { key, canvas }
    return canvas
  }
}
