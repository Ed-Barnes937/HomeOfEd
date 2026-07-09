import { describe, expect, it } from 'vitest'

import { rakePresets } from '../engine/rake.ts'
import { rakeSegment } from './sand.ts'
import { SandRenderer } from './SandRenderer.ts'

type Point = [number, number]

/**
 * A recording stub 2D context — the vitest env is `node`, so there is no real
 * canvas. It counts the calls the pure helpers make; pixel output is not
 * asserted (visual, out of scope).
 */
interface Recorder {
  strokes: number
  beginPaths: number
}

function makeCtx(): { ctx: CanvasRenderingContext2D; rec: Recorder } {
  const rec: Recorder = { strokes: 0, beginPaths: 0 }
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
    stroke: () => {
      rec.strokes++
    },
    setTransform: () => {},
  } as unknown as CanvasRenderingContext2D
  return { ctx, rec }
}

describe('rakeSegment', () => {
  const pts: Point[] = Array.from({ length: 20 }, (_, i) => [i, i * 0.5])
  const norm: Point[] = Array.from({ length: 20 }, () => [0, 1])

  it('emboss-strokes each tine three times (shadow + highlight + groove)', () => {
    for (const [id, preset] of Object.entries(rakePresets())) {
      const { ctx, rec } = makeCtx()
      rakeSegment(ctx, pts, norm, preset, 0, 19, 0, 0)
      expect(rec.strokes, `rake=${id}`).toBe(preset.tines * 3)
      expect(rec.beginPaths, `rake=${id}`).toBe(preset.tines * 3)
    }
  })

  it('draws one polyline per tine (marble=1, wide=4, deep=3, fine=7)', () => {
    const counts = { marble: 1, wide: 4, deep: 3, fine: 7 } as const
    const presets = rakePresets()
    for (const [id, tines] of Object.entries(counts)) {
      const { ctx, rec } = makeCtx()
      rakeSegment(ctx, pts, norm, presets[id as keyof typeof presets], 0, 19, 0, 0)
      expect(rec.strokes / 3, `rake=${id}`).toBe(tines)
    }
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

  it('toDataURL returns a PNG data url', () => {
    const renderer = new SandRenderer(makeCanvas())
    expect(renderer.toDataURL().startsWith('data:image/png')).toBe(true)
  })
})
