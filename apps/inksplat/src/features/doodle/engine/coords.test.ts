import { describe, expect, it } from 'vitest'

import { computeFit, toDevice, toLogical } from './coords.ts'
import type { Point, ViewBox } from './types.ts'

const vb: ViewBox = { width: 100, height: 100 }

describe('computeFit', () => {
  it('limits scale by height and centres horizontally when the canvas is wider than the viewBox', () => {
    const fit = computeFit(vb, 400, 200)
    expect(fit.scale).toBe(2) // min(400/100, 200/100) = 2 (height-limited)
    expect(fit.offsetX).toBe(100) // (400 - 100*2) / 2
    expect(fit.offsetY).toBe(0)
  })

  it('limits scale by width and centres vertically when the canvas is taller than the viewBox', () => {
    const fit = computeFit(vb, 200, 400)
    expect(fit.scale).toBe(2) // min(200/100, 400/100) = 2 (width-limited)
    expect(fit.offsetX).toBe(0)
    expect(fit.offsetY).toBe(100) // (400 - 100*2) / 2
  })

  it('fills with zero offset when the aspect ratio matches', () => {
    const fit = computeFit(vb, 300, 300)
    expect(fit.scale).toBe(3)
    expect(fit.offsetX).toBe(0)
    expect(fit.offsetY).toBe(0)
  })
})

describe('toDevice / toLogical round-trip', () => {
  const fits = [
    computeFit(vb, 400, 200),
    computeFit(vb, 200, 400),
    computeFit(vb, 300, 300),
    computeFit({ width: 1550, height: 760 }, 1000, 900),
  ]
  const points: Point[] = [
    { x: 0, y: 0 },
    { x: 50, y: 50 },
    { x: 12.5, y: 87.25 },
    { x: 100, y: 100 },
  ]

  it('toLogical(toDevice(p)) ≈ p for several fits and points', () => {
    for (const fit of fits) {
      for (const p of points) {
        const back = toLogical(toDevice(p, fit), fit)
        expect(back.x).toBeCloseTo(p.x, 10)
        expect(back.y).toBeCloseTo(p.y, 10)
      }
    }
  })

  it('toDevice applies scale then centred offset', () => {
    const fit = computeFit(vb, 400, 200)
    expect(toDevice({ x: 50, y: 50 }, fit)).toEqual({ x: 200, y: 100 })
  })
})
