// The BlitProbe window seam, in its own module: the spec imports the key and
// type from here, because Playwright CT rewrites any module it takes a mounted
// component from and would clash on the extra value exports.
export const BLIT_PROBE_KEY = '__siltBlitProbe'

/** One cell's identity, what each frame path actually drew for it, and what the palette says. */
export interface BlitProbeCell {
  species: number
  /** The colour-variant byte the sim seeded — what both paths must agree on shading by. */
  rb: number
  /** RGB read back from the WebGL framebuffer at the cell's centre. */
  webgl: number[]
  /** RGB read back from the Canvas 2D renderer's own canvas, at the same point. */
  canvas2d: number[]
  /** RGB the registry palette holds for this cell's `(species, rb)` slot. */
  palette: number[]
}

export interface BlitProbeApi {
  /** One cell, read back from both on-screen canvases and looked up in the palette. */
  compareCell(x: number, y: number): BlitProbeCell
  /** The same, for a horizontal run of cells — how mixed variants are exercised. */
  compareRun(x0: number, x1: number, y: number): BlitProbeCell[]
  /** Both paths' RGB in the letterbox margin, plus the expected world colour. */
  compareMargin(): { webgl: number[]; canvas2d: number[]; world: number[] }
  /** Mean ms per `draw()` for each path over `frames` draws (CPU submit cost; webglFinished adds a gl.finish()). */
  benchDraw(frames: number): { canvas2d: number; webgl: number; webglFinished: number }
}
