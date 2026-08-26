import { GRID_HEIGHT, GRID_WIDTH } from '../../sim/index.ts'
import type { ElementRegistry } from '../../sim/index.ts'
import {
  canvasPointToGrid,
  computeLetterboxFit,
  gridToCanvasPoint,
  type Rect,
} from './letterboxFit.ts'
import type { RenderableSim, WorldRenderer } from './renderer.ts'
import {
  buildSpeciesPalette,
  hexToRgb,
  packPaletteTexture,
  rasteriseSpecies,
  WORLD_COLOUR,
  type SpeciesPalette,
} from './speciesPalette.ts'

// One clip-space triangle covering the viewport — no vertex buffer, the
// corners come from gl_VertexID.
const VERTEX_SHADER = `#version 300 es
const vec2 corners[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 v_uv;
void main() {
  vec2 pos = corners[gl_VertexID];
  v_uv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`

// The grid uploads as-is (RGBA8UI, species in R, rb in B for later per-cell
// variance shading); colour is a palette-texture lookup, so the canvas reads
// the same registry-derived table as the rail (spec §9).
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp usampler2D;
uniform usampler2D u_grid;
uniform sampler2D u_palette;
in vec2 v_uv;
out vec4 outColour;
void main() {
  ivec2 gridSize = textureSize(u_grid, 0);
  // v_uv.y = 0 is the viewport's bottom edge; grid row 0 is the world's top.
  ivec2 cell = ivec2(vec2(v_uv.x, 1.0 - v_uv.y) * vec2(gridSize));
  cell = clamp(cell, ivec2(0), gridSize - 1);
  uint species = texelFetch(u_grid, cell, 0).r;
  outColour = texelFetch(u_palette, ivec2(int(species), 0), 0);
}
`

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('WebGL shader allocation failed')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    throw new Error(`WebGL shader compile failed: ${gl.getShaderInfoLog(shader) ?? ''}`)
  }
  return shader
}

/**
 * The WebGL2 frame path (120fps ticket 01): upload the interleaved 4-byte
 * cells as one RGBA8UI texture each frame — zero repack — and draw one quad
 * whose fragment shader maps species to colour. Letterboxing, DPR fit and the
 * grid↔canvas maths are shared with `SimRenderer`; `snapshot()` keeps the CPU
 * rasterise (user-initiated, off the frame path). A lost context is absorbed:
 * the sim owns the world, this class owns nothing it can't rebuild.
 */
export class WebGLSimRenderer implements WorldRenderer {
  readonly kind = 'webgl2' as const
  private readonly gl: WebGL2RenderingContext
  private readonly palette: SpeciesPalette
  private readonly clear: [number, number, number]
  private program: WebGLProgram | null = null
  private gridTexture: WebGLTexture | null = null
  private lastCells: Uint8Array | null = null
  private buffer: HTMLCanvasElement | null = null
  private fit: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private cssWidth = 0
  private cssHeight = 0
  private dpr = 1

  private readonly onContextLost = (event: Event): void => {
    // Without preventDefault the browser never fires the restore event.
    event.preventDefault()
  }
  private readonly onContextRestored = (): void => {
    this.initGL()
  }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    registry: ElementRegistry,
  ) {
    this.gl = gl
    this.palette = buildSpeciesPalette(registry)
    const [r, g, b] = hexToRgb(WORLD_COLOUR)
    this.clear = [r / 255, g / 255, b / 255]
    canvas.addEventListener('webglcontextlost', this.onContextLost)
    canvas.addEventListener('webglcontextrestored', this.onContextRestored)
    this.initGL()
  }

  /** Build (or rebuild, after a context restore) the program and textures. */
  private initGL(): void {
    const gl = this.gl
    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER))
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error(`WebGL program link failed: ${gl.getProgramInfoLog(program) ?? ''}`)
    }
    gl.useProgram(program)
    gl.uniform1i(gl.getUniformLocation(program, 'u_grid'), 0)
    gl.uniform1i(gl.getUniformLocation(program, 'u_palette'), 1)
    this.program = program

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)

    gl.activeTexture(gl.TEXTURE1)
    const paletteTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, paletteTexture)
    configureTexture(gl)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 256, 1)
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      256,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      packPaletteTexture(this.palette),
    )

    gl.activeTexture(gl.TEXTURE0)
    this.gridTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.gridTexture)
    configureTexture(gl)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, GRID_WIDTH, GRID_HEIGHT)
  }

  /** Stop listening on the canvas — for the owning effect's cleanup. */
  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored)
  }

  /** DPR-aware backing store, re-evaluated on resize/zoom (spec §6). */
  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.cssWidth = cssWidth
    this.cssHeight = cssHeight
    this.dpr = dpr
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr))
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr))
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

  /**
   * The world as a PNG data URL, one pixel per cell — the scene-row thumbnail
   * (spec §9). User-initiated and off the frame path, so it CPU-rasterises the
   * last-drawn cells into a lazily created 2D buffer; never `readPixels`.
   */
  snapshot(): string {
    if (!this.buffer) {
      this.buffer = document.createElement('canvas')
      this.buffer.width = GRID_WIDTH
      this.buffer.height = GRID_HEIGHT
    }
    const ctx = this.buffer.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    if (this.lastCells) {
      const imageData = ctx.createImageData(GRID_WIDTH, GRID_HEIGHT)
      rasteriseSpecies(this.lastCells, this.palette, imageData.data)
      ctx.putImageData(imageData, 0, 0)
    }
    return this.buffer.toDataURL('image/png')
  }

  /** Upload the cells, clear to the world colour, draw the letterboxed quad. */
  draw(sim: RenderableSim): void {
    this.lastCells = sim.cells
    const gl = this.gl
    if (gl.isContextLost()) return

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.gridTexture)
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      GRID_WIDTH,
      GRID_HEIGHT,
      gl.RGBA_INTEGER,
      gl.UNSIGNED_BYTE,
      sim.cells,
    )

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.clearColor(this.clear[0], this.clear[1], this.clear[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (this.fit.width > 0 && this.fit.height > 0) {
      const x = Math.round(this.fit.x * this.dpr)
      const yTop = Math.round(this.fit.y * this.dpr)
      const width = Math.round(this.fit.width * this.dpr)
      const height = Math.round(this.fit.height * this.dpr)
      // GL viewport origin is the bottom-left corner; the fit is top-left.
      gl.viewport(x, gl.drawingBufferHeight - yTop - height, width, height)
      gl.useProgram(this.program)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
  }
}

/** NEAREST + clamp — crisp pixels, and mandatory for integer textures anyway. */
function configureTexture(gl: WebGL2RenderingContext): void {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
}
