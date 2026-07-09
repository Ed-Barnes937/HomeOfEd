import { describe, expect, it } from 'vitest'

import { gardenCurves } from '../engine/garden.ts'
import { DEFAULT_CONFIG } from '../engine/state.ts'
import { clearingSweep, drawGroove, drawMarble, gardenBed } from './sand.ts'
import { SandRenderer } from './SandRenderer.ts'

type Point = [number, number]

/**
 * A recording stub 2D context — the vitest env is `node`, so there is no real
 * canvas. It counts the calls the pure helpers make; pixel output is not
 * asserted (visual, out of scope).
 */
interface Recorder {
  strokes: number
  fills: number
  beginPaths: number
  clips: number
}

function makeCtx(): { ctx: CanvasRenderingContext2D; rec: Recorder } {
  const rec: Recorder = { strokes: 0, fills: 0, beginPaths: 0, clips: 0 }
  const grad = { addColorStop: () => {} }
  const ctx = {
    lineJoin: '',
    lineCap: '',
    strokeStyle: '',
    lineWidth: 0,
    fillStyle: '',
    beginPath: () => {
      rec.beginPaths++
    },
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    closePath: () => {},
    stroke: () => {
      rec.strokes++
    },
    fill: () => {
      rec.fills++
    },
    clip: () => {
      rec.clips++
    },
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    clearRect: () => {},
    createRadialGradient: () => grad,
  } as unknown as CanvasRenderingContext2D
  return { ctx, rec }
}

describe('drawGroove', () => {
  const pts: Point[] = Array.from({ length: 20 }, (_, i) => [i, i * 0.5])

  it('strokes a groove three times (shadow + highlight + core)', () => {
    const { ctx, rec } = makeCtx()
    drawGroove(ctx, pts, 19, 0, 0)
    expect(rec.strokes).toBe(3)
    expect(rec.beginPaths).toBe(3)
  })
})

describe('gardenBed / drawMarble', () => {
  it('gardenBed fills one radial bed', () => {
    const { ctx, rec } = makeCtx()
    gardenBed(ctx, 100, 100, 90)
    expect(rec.fills).toBe(1)
  })

  it('drawMarble fills two arcs (halo + ball) and strokes the rim', () => {
    const { ctx, rec } = makeCtx()
    drawMarble(ctx, 50, 50)
    expect(rec.fills).toBe(2)
    expect(rec.strokes).toBe(1)
  })
})

describe('clearingSweep', () => {
  it('clips the swept wedge, re-fills the bed, and combs the leading edge', () => {
    const { ctx, rec } = makeCtx()
    clearingSweep(ctx, 100, 100, 90, 0.5)
    expect(rec.clips).toBe(1)
    expect(rec.fills).toBe(1) // the re-filled bed wedge
    expect(rec.strokes).toBeGreaterThan(0) // the comb head + teeth
  })
})

/** A fake canvas backing store — the constructor grabs a context via getContext. */
function makeCanvas(): HTMLCanvasElement {
  const { ctx } = makeCtx()
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toDataURL: (type?: string) => `data:${type ?? 'image/png'};base64,AAAA`,
  } as unknown as HTMLCanvasElement
}

describe('SandRenderer', () => {
  it('resize sets the backing store to round(cssSize * dpr)', () => {
    const canvas = makeCanvas()
    const renderer = new SandRenderer(canvas)
    renderer.resize(524, 2)
    expect(canvas.width).toBe(Math.round(524 * 2))
    expect(canvas.height).toBe(Math.round(524 * 2))
  })

  it('caps dpr at 2 when rebuilding the backing store', () => {
    const canvas = makeCanvas()
    const renderer = new SandRenderer(canvas)
    renderer.resize(300, 3)
    expect(canvas.width).toBe(Math.round(300 * 2))
  })

  it('carveTo draws one groove per cog', () => {
    const canvas = makeCanvas()
    const renderer = new SandRenderer(canvas)
    renderer.resize(500, 1)
    const garden = gardenCurves({ ...DEFAULT_CONFIG, wheels: [52, 30, 24] }, 230)
    renderer.beginCarve(garden)
    renderer.carveTo(0.5)
    expect(garden.curves.length).toBe(3)
  })

  it('toDataURL returns a PNG data url', () => {
    const renderer = new SandRenderer(makeCanvas())
    expect(renderer.toDataURL().startsWith('data:image/png')).toBe(true)
  })
})
