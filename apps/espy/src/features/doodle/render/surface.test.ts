import { describe, expect, it } from 'vitest'

import { generateField } from '../engine/field.ts'
import { EYE_BASE, makeEye } from '../engine/eye.ts'
import { mulberry32 } from '../engine/rng.ts'
import type { Op } from '../engine/types.ts'
import { SKETCHBOOK } from '../theme.ts'
import { DoodleSurface } from './surface.ts'

/**
 * Recording 2D-context stub — records draw calls in order and every
 * `globalAlpha` write, so tests assert STRUCTURE (call counts/order, cap/join),
 * never pixels. Mirrors boids' renderer-test approach.
 */
interface RecordedCall {
  m: string
  args: unknown[]
  lineCap?: string
  lineJoin?: string
}

function recordingContext() {
  const calls: RecordedCall[] = []
  const alphaWrites: number[] = []
  let alpha = 1
  const rec =
    (m: string) =>
    (...args: unknown[]) => {
      calls.push({ m, args })
    }
  const ctx = {
    calls,
    alphaWrites,
    fillStyle: '' as string,
    strokeStyle: '' as string,
    lineWidth: 0,
    lineCap: 'butt' as string,
    lineJoin: 'miter' as string,
    get globalAlpha() {
      return alpha
    },
    set globalAlpha(v: number) {
      alpha = v
      alphaWrites.push(v)
    },
    setTransform: rec('setTransform'),
    fillRect: rec('fillRect'),
    drawImage: rec('drawImage'),
    beginPath: rec('beginPath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    quadraticCurveTo: rec('quadraticCurveTo'),
    arc: rec('arc'),
    closePath: rec('closePath'),
    fill: rec('fill'),
    stroke(): void {
      calls.push({ m: 'stroke', args: [], lineCap: ctx.lineCap, lineJoin: ctx.lineJoin })
    },
  }
  return ctx
}

type Rec = ReturnType<typeof recordingContext>

function fakeCanvas(ctx: Rec): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    getContext: (kind: string) => (kind === '2d' ? ctx : null),
  } as unknown as HTMLCanvasElement
}

/** A field op with a known blot set (deterministic under a seeded rng). */
function fieldOp(width: number, height: number, seed: number): Op {
  const vb = { width, height }
  return { type: 'field', viewBox: vb, blots: generateField(vb, mulberry32(seed)) }
}

const DRAW_METHODS = ['fillRect', 'drawImage', 'fill', 'stroke', 'arc', 'quadraticCurveTo', 'lineTo']

describe('DoodleSurface', () => {
  it('sizes the backing store to css × min(dpr, 2)', () => {
    const ctx = recordingContext()
    const canvas = fakeCanvas(ctx)
    const surface = new DoodleSurface(canvas)
    surface.resize(400, 300, 3) // dpr clamped to 2
    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(600)
  })

  it('paints paper first — one full-rect fillRect before any art', () => {
    const ctx = recordingContext()
    const surface = new DoodleSurface(fakeCanvas(ctx))
    surface.resize(400, 300, 2)
    surface.renderOps([fieldOp(400, 300, 7)], SKETCHBOOK)

    const firstDraw = ctx.calls.find((c) => DRAW_METHODS.includes(c.m))
    expect(firstDraw?.m).toBe('fillRect')
    // full device rect = backing store size (800 × 600)
    expect(firstDraw?.args).toEqual([0, 0, 800, 600])
  })

  it('blits the baked field raster once when one is supplied, tracing no blots', () => {
    const ctx = recordingContext()
    const surface = new DoodleSurface(fakeCanvas(ctx))
    surface.resize(720, 850, 1)
    const field = fieldOp(720, 850, 42)
    const bakedImage = { width: 720, height: 850 } as unknown as CanvasImageSource
    surface.renderOps([field], SKETCHBOOK, bakedImage)

    const draws = ctx.calls.filter((c) => c.m === 'drawImage')
    expect(draws).toHaveLength(1)
    expect(draws[0]?.args).toEqual([bakedImage, 0, 0, 720, 850])
    // The raster IS the field — no outline tracing when it's present.
    expect(ctx.calls.some((c) => c.m === 'closePath')).toBe(false)
  })

  it('falls back to a plain blot fill (one outline + one fill per blot, plus satellites)', () => {
    const ctx = recordingContext()
    const surface = new DoodleSurface(fakeCanvas(ctx))
    surface.resize(720, 850, 1)
    const field = fieldOp(720, 850, 42)
    const blots = field.type === 'field' ? field.blots : []
    expect(blots.length).toBeGreaterThan(1)
    surface.renderOps([field], SKETCHBOOK) // no baked image → fallback

    const satTotal = blots.reduce((n, b) => n + b.satellites.length, 0)
    const closes = ctx.calls.filter((c) => c.m === 'closePath').length
    const fills = ctx.calls.filter((c) => c.m === 'fill').length
    const arcs = ctx.calls.filter((c) => c.m === 'arc').length

    expect(closes).toBe(blots.length) // one closed outline per blot
    expect(arcs).toBe(satTotal) // arcs are only satellites in a pure field
    expect(fills).toBe(blots.length + satTotal) // one per blot + one per satellite
    expect(ctx.calls.some((c) => c.m === 'drawImage')).toBe(false)
  })

  it('strokes each stroke op once with round cap and join', () => {
    const ctx = recordingContext()
    const surface = new DoodleSurface(fakeCanvas(ctx))
    surface.resize(400, 300, 1)
    const emptyField: Op = { type: 'field', viewBox: { width: 400, height: 300 }, blots: [] }
    const stroke: Op = {
      type: 'stroke',
      stroke: { color: '#171717', width: 3.4, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 1 }] },
    }
    surface.renderOps([emptyField, stroke], SKETCHBOOK)

    const strokes = ctx.calls.filter((c) => c.m === 'stroke')
    expect(strokes).toHaveLength(1)
    expect(strokes[0]?.lineCap).toBe('round')
    expect(strokes[0]?.lineJoin).toBe('round')
  })

  it('renders each eye op as 3 fills (white, pupil, highlight) plus 1 stroke', () => {
    const ctx = recordingContext()
    const surface = new DoodleSurface(fakeCanvas(ctx))
    surface.resize(400, 300, 1)
    const emptyField: Op = { type: 'field', viewBox: { width: 400, height: 300 }, blots: [] }
    const eye: Op = { type: 'eye', eye: makeEye(100, 100, EYE_BASE, mulberry32(3)) }
    surface.renderOps([emptyField, eye], SKETCHBOOK)

    expect(ctx.calls.filter((c) => c.m === 'fill')).toHaveLength(3)
    expect(ctx.calls.filter((c) => c.m === 'stroke')).toHaveLength(1)
  })

  it('never writes a fractional globalAlpha (the field is baked, not bloomed on the 2D canvas)', () => {
    const ctx = recordingContext()
    const surface = new DoodleSurface(fakeCanvas(ctx))
    surface.resize(400, 300, 1)
    surface.renderOps([fieldOp(400, 300, 7)], SKETCHBOOK)
    expect(ctx.alphaWrites.length).toBeGreaterThan(0)
    expect(ctx.alphaWrites.every((a) => a === 1)).toBe(true)
  })
})
