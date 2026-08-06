import { BYTES_PER_CELL, GRID_HEIGHT, GRID_WIDTH, SPECIES_OFFSET } from '../../sim/index.ts'
import type { ElementRegistry } from '../../sim/index.ts'
import {
  canvasPointToGrid,
  computeLetterboxFit,
  gridToCanvasPoint,
  type Rect,
} from './letterboxFit.ts'
import { buildPalette, WORLD_COLOUR, type Palette } from './palette.ts'

/**
 * Narrow sim → renderer seam (spec §5.5): the renderer reads only this
 * grid-shaped state, never Sim internals (tick/paint/PRNG). Canvas 2D today;
 * WebGL is a drop-in later behind the same shape.
 */
export interface RenderableSim {
  readonly width: number
  readonly height: number
  readonly cells: Uint8Array
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  return ctx
}

/**
 * Sim draws into a 300×200 backing buffer, one pixel per cell (spec §6); the
 * on-screen canvas is a DPR-aware backing store (`cssSize × dpr`) that scales
 * the buffer up into the play area, aspect-preserving and letterboxed, with
 * smoothing off. Resize refits this canvas only — the sim is never touched.
 */
export class SimRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private readonly buffer: HTMLCanvasElement
  private readonly bufferCtx: CanvasRenderingContext2D
  private readonly imageData: ImageData
  private readonly palette: Palette
  private fit: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private cssWidth = 0
  private cssHeight = 0
  private dpr = 1

  constructor(canvas: HTMLCanvasElement, registry: ElementRegistry) {
    this.ctx = context2d(canvas)
    this.ctx.imageSmoothingEnabled = false

    this.buffer = document.createElement('canvas')
    this.buffer.width = GRID_WIDTH
    this.buffer.height = GRID_HEIGHT
    this.bufferCtx = context2d(this.buffer)
    this.imageData = this.bufferCtx.createImageData(GRID_WIDTH, GRID_HEIGHT)
    this.palette = buildPalette(registry)
  }

  /** DPR-aware backing store, re-evaluated on resize/zoom (spec §6). */
  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.cssWidth = cssWidth
    this.cssHeight = cssHeight
    this.dpr = dpr
    this.ctx.canvas.width = Math.max(1, Math.round(cssWidth * dpr))
    this.ctx.canvas.height = Math.max(1, Math.round(cssHeight * dpr))
    this.ctx.imageSmoothingEnabled = false
    this.fit = computeLetterboxFit(cssWidth, cssHeight, GRID_WIDTH, GRID_HEIGHT)
  }

  getFit(): Rect {
    return this.fit
  }

  /** Grid cell → CSS-px point on the on-screen canvas (cell centre). */
  gridToCanvasPoint(x: number, y: number): { x: number; y: number } {
    return gridToCanvasPoint(this.fit, GRID_WIDTH, GRID_HEIGHT, x, y)
  }

  /** CSS-px point on the on-screen canvas → grid cell, or `null` in the letterbox margin. */
  canvasPointToGrid(x: number, y: number): { x: number; y: number } | null {
    return canvasPointToGrid(this.fit, GRID_WIDTH, GRID_HEIGHT, x, y)
  }

  /** Rasterise the grid into the backing buffer, then blit it scaled and letterboxed. */
  draw(sim: RenderableSim): void {
    const { cells } = sim
    const pixels = this.imageData.data
    const palette = this.palette
    for (let cell = 0, i = SPECIES_OFFSET; i < cells.length; i += BYTES_PER_CELL, cell++) {
      const species = cells[i] ?? 0
      const c = species * 3
      const p = cell * 4
      pixels[p] = palette[c] ?? 0
      pixels[p + 1] = palette[c + 1] ?? 0
      pixels[p + 2] = palette[c + 2] ?? 0
      pixels[p + 3] = 255
    }
    this.bufferCtx.putImageData(this.imageData, 0, 0)

    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.fillStyle = WORLD_COLOUR
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight)
    if (this.fit.width > 0 && this.fit.height > 0) {
      ctx.drawImage(this.buffer, this.fit.x, this.fit.y, this.fit.width, this.fit.height)
    }
  }
}
