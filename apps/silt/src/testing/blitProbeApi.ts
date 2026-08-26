// The BlitProbe window seam, in its own module: the spec imports the key and
// type from here, because Playwright CT rewrites any module it takes a mounted
// component from and would clash on the extra value exports.
export const BLIT_PROBE_KEY = '__siltBlitProbe'

export interface BlitProbeApi {
  /** Species at the cell, WebGL framebuffer RGB at its centre, and the palette RGB for that species. */
  compareCell(x: number, y: number): { species: number; webgl: number[]; palette: number[] }
  /** WebGL framebuffer RGB in the letterbox margin, plus the expected world colour. */
  compareMargin(): { webgl: number[]; world: number[] }
  /** Mean ms per `draw()` for each path over `frames` draws (CPU submit cost; webglFinished adds a gl.finish()). */
  benchDraw(frames: number): { canvas2d: number; webgl: number; webglFinished: number }
}
