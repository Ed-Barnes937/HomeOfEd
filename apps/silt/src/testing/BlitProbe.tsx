// Test-only probe for the two frame paths (120fps ticket 01): mounts one
// canvas per renderer, a paused Sim behind both, and exposes pixel-parity and
// draw-timing hooks on the window. Parity reads the WebGL framebuffer back and
// compares it with the registry palette the CPU path rasterises from — the
// two lookups share a table but nothing else, so a shader that drifts fails.
import { useEffect, useRef } from 'react'

import { SimRenderer } from '../features/render/renderer.ts'
import { buildSpeciesPalette, hexToRgb, WORLD_COLOUR } from '../features/render/speciesPalette.ts'
import { WebGLSimRenderer } from '../features/render/webglRenderer.ts'
import { DIRT, GRID_HEIGHT, GRID_WIDTH, Sim, STONE, WATER, WOOD } from '../sim/index.ts'
import { BLIT_PROBE_KEY, type BlitProbeApi } from './blitProbeApi.ts'

/** CSS px; dpr fixed at 1 so CSS px = device px and cell centres land exactly. */
const CANVAS_WIDTH = 1240
const CANVAS_HEIGHT = 800

function fill(sim: Sim, x0: number, y0: number, x1: number, y1: number, species: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      sim.paint(x, y, species)
    }
  }
}

/** The perf bench's mixed world — a representative cell spread, never ticked. */
function paintMixedWorld(sim: Sim): void {
  const floorTop = GRID_HEIGHT - 3
  fill(sim, 0, floorTop, GRID_WIDTH - 1, GRID_HEIGHT - 1, STONE)
  fill(sim, 20, 175, 90, floorTop - 1, WATER)
  fill(sim, 120, 180, 170, floorTop - 1, WOOD)
  fill(sim, 200, 170, 290, floorTop - 1, DIRT)
}

export function BlitProbe() {
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null)
  const webglRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas2d = canvas2dRef.current
    const webglCanvas = webglRef.current
    if (!canvas2d || !webglCanvas) return

    const sim = new Sim()
    paintMixedWorld(sim)
    const palette = buildSpeciesPalette(sim.registry)

    const renderer2d = new SimRenderer(canvas2d, sim.registry)
    renderer2d.resize(CANVAS_WIDTH, CANVAS_HEIGHT, 1)

    const gl = webglCanvas.getContext('webgl2')
    if (!gl) throw new Error('BlitProbe needs webgl2')
    const rendererGl = new WebGLSimRenderer(webglCanvas, gl, sim.registry)
    rendererGl.resize(CANVAS_WIDTH, CANVAS_HEIGHT, 1)

    // The probe times and reads raw draws, so every call must actually draw:
    // both renderers skip a frame whose revision they are already showing
    // (ticket 06), and this sim is painted once and never ticked. Hand each
    // draw a fresh revision instead of the sim's own.
    let probeRevision = 0
    const renderable = () => ({
      width: sim.width,
      height: sim.height,
      cells: sim.cells,
      revision: ++probeRevision,
    })

    const readPixel = (deviceX: number, deviceYFromTop: number): number[] => {
      rendererGl.draw(renderable())
      const out = new Uint8Array(4)
      // readPixels in the same task as the draw, so the buffer is still live.
      gl.readPixels(
        deviceX,
        webglCanvas.height - 1 - deviceYFromTop,
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        out,
      )
      return [out[0] ?? 0, out[1] ?? 0, out[2] ?? 0]
    }

    const api: BlitProbeApi = {
      compareCell: (x, y) => {
        const species = sim.speciesAt(x, y)
        const point = rendererGl.gridToCanvasPoint(x, y)
        return {
          species,
          webgl: readPixel(Math.round(point.x), Math.round(point.y)),
          palette: [
            palette[species * 3] ?? 0,
            palette[species * 3 + 1] ?? 0,
            palette[species * 3 + 2] ?? 0,
          ],
        }
      },
      compareMargin: () => ({
        // The fit is centred, so device x=2 sits in the left letterbox bar.
        webgl: readPixel(2, Math.round(CANVAS_HEIGHT / 2)),
        world: [...hexToRgb(WORLD_COLOUR)],
      }),
      benchDraw: (frames) => {
        const time = (draw: () => void): number => {
          const start = performance.now()
          for (let i = 0; i < frames; i++) draw()
          return (performance.now() - start) / frames
        }
        // Warm both paths before timing them.
        renderer2d.draw(renderable())
        rendererGl.draw(renderable())
        const canvas2d = time(() => renderer2d.draw(renderable()))
        const webgl = time(() => rendererGl.draw(renderable()))
        const finishStart = performance.now()
        for (let i = 0; i < frames; i++) rendererGl.draw(renderable())
        gl.finish()
        const webglFinished = (performance.now() - finishStart) / frames
        return { canvas2d, webgl, webglFinished }
      },
    }
    ;(window as unknown as Record<string, BlitProbeApi>)[BLIT_PROBE_KEY] = api

    return () => {
      rendererGl.dispose()
      delete (window as unknown as Record<string, BlitProbeApi | undefined>)[BLIT_PROBE_KEY]
    }
  }, [])

  const style = { width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px` }
  return (
    <div>
      <canvas ref={canvas2dRef} data-testid="blit-2d" style={style} />
      <canvas ref={webglRef} data-testid="blit-webgl" style={style} />
    </div>
  )
}
