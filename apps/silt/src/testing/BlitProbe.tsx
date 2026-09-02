// Test-only probe for the two frame paths (120fps ticket 01): mounts one
// canvas per renderer, a paused Sim behind both, and exposes pixel-parity and
// draw-timing hooks on the window. Parity reads back what each path actually
// put on screen — the WebGL framebuffer and the 2D canvas — and compares both
// with the registry palette. The three share a table and nothing else: the
// shader indexes it with its own arithmetic and the 2D loop with its own, so
// either drifting fails here (sandspiel ticket 03).
import { useEffect, useRef } from 'react'

import { SimRenderer } from '../features/render/renderer.ts'
import {
  buildSpeciesPalette,
  hexToRgb,
  paletteSlot,
  WORLD_COLOUR,
} from '../features/render/speciesPalette.ts'
import { WebGLSimRenderer } from '../features/render/webglRenderer.ts'
import { DIRT, GRID_HEIGHT, GRID_WIDTH, Sim, STONE, WATER, WOOD } from '../sim/index.ts'
import { BLIT_PROBE_KEY, type BlitProbeApi, type BlitProbeCell } from './blitProbeApi.ts'

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

    // Reads only — the caller draws first, in the same task, so the buffer is
    // still live. Kept apart from the draw so a run of cells costs one frame.
    const readPixel = (deviceX: number, deviceYFromTop: number): number[] => {
      const out = new Uint8Array(4)
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

    const ctx2d = canvas2d.getContext('2d')
    if (!ctx2d) throw new Error('BlitProbe needs a 2D context')
    const read2dPixel = (deviceX: number, deviceYFromTop: number): number[] => {
      const { data } = ctx2d.getImageData(deviceX, deviceYFromTop, 1, 1)
      return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0]
    }

    const readCell = (x: number, y: number): BlitProbeCell => {
      const species = sim.speciesAt(x, y)
      const rb = sim.rbAt(x, y)
      const point = rendererGl.gridToCanvasPoint(x, y)
      const deviceX = Math.round(point.x)
      const deviceY = Math.round(point.y)
      const slot = paletteSlot(species, rb) * 3
      return {
        species,
        rb,
        webgl: readPixel(deviceX, deviceY),
        canvas2d: read2dPixel(deviceX, deviceY),
        palette: [palette[slot] ?? 0, palette[slot + 1] ?? 0, palette[slot + 2] ?? 0],
      }
    }

    /** Both paths draw the same world, in one task, so both readbacks are live. */
    const drawBoth = (): void => {
      const frame = renderable()
      renderer2d.draw(frame)
      rendererGl.draw(frame)
    }

    const api: BlitProbeApi = {
      compareCell: (x, y) => {
        drawBoth()
        return readCell(x, y)
      },
      compareRun: (x0, x1, y) => {
        drawBoth()
        return Array.from({ length: x1 - x0 + 1 }, (_, i) => readCell(x0 + i, y))
      },
      compareMargin: () => {
        drawBoth()
        const deviceY = Math.round(CANVAS_HEIGHT / 2)
        return {
          // The fit is centred, so device x=2 sits in the left letterbox bar.
          webgl: readPixel(2, deviceY),
          canvas2d: read2dPixel(2, deviceY),
          world: [...hexToRgb(WORLD_COLOUR)],
        }
      },
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
