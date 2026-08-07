import { describe, expect, it } from 'vitest'

import { canvasPointToGrid, computeLetterboxFit, gridToCanvasPoint } from './letterboxFit.ts'

const GRID_WIDTH = 300
const GRID_HEIGHT = 200

describe('computeLetterboxFit', () => {
  it('fills exactly when the container matches the grid aspect ratio (3:2)', () => {
    const fit = computeLetterboxFit(600, 400, GRID_WIDTH, GRID_HEIGHT)
    expect(fit).toEqual({ x: 0, y: 0, width: 600, height: 400 })
  })

  it('letterboxes top and bottom in a wider-than-grid container', () => {
    // 1000x400 is wider than 3:2, so height is the binding dimension.
    const fit = computeLetterboxFit(1000, 400, GRID_WIDTH, GRID_HEIGHT)
    expect(fit.width).toBeCloseTo(600)
    expect(fit.height).toBeCloseTo(400)
    expect(fit.x).toBeCloseTo(200)
    expect(fit.y).toBeCloseTo(0)
  })

  it('letterboxes left and right in a taller-than-grid (narrower) container', () => {
    // 300x400 is narrower than 3:2, so width is the binding dimension.
    const fit = computeLetterboxFit(300, 400, GRID_WIDTH, GRID_HEIGHT)
    expect(fit.width).toBeCloseTo(300)
    expect(fit.height).toBeCloseTo(200)
    expect(fit.x).toBeCloseTo(0)
    expect(fit.y).toBeCloseTo(100)
  })

  it('allows fractional scale factors', () => {
    const fit = computeLetterboxFit(700, 500, GRID_WIDTH, GRID_HEIGHT)
    // height-bound: scale = 500/200 = 2.5 -> width = 750, wider than container,
    // so it's actually width-bound: scale = 700/300 = 2.333...
    const scale = 700 / GRID_WIDTH
    expect(fit.width).toBeCloseTo(700)
    expect(fit.height).toBeCloseTo(GRID_HEIGHT * scale)
  })

  it('returns a zero rect for a zero-sized container rather than dividing by zero', () => {
    expect(computeLetterboxFit(0, 0, GRID_WIDTH, GRID_HEIGHT)).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    })
  })
})

describe('gridToCanvasPoint / canvasPointToGrid', () => {
  const fit = computeLetterboxFit(600, 400, GRID_WIDTH, GRID_HEIGHT)

  it('maps the centre of a grid cell to a CSS point inside the fit rect', () => {
    const point = gridToCanvasPoint(fit, GRID_WIDTH, GRID_HEIGHT, 150, 100)
    expect(point.x).toBeCloseTo(300 + 1) // (150 + 0.5) * scale(2)
    expect(point.y).toBeCloseTo(200 + 1) // (100 + 0.5) * scale(2)
  })

  it('round-trips a grid cell through gridToCanvasPoint and back', () => {
    const point = gridToCanvasPoint(fit, GRID_WIDTH, GRID_HEIGHT, 42, 17)
    const cell = canvasPointToGrid(fit, GRID_WIDTH, GRID_HEIGHT, point.x, point.y)
    expect(cell).toEqual({ x: 42, y: 17 })
  })

  it('returns null for a CSS point outside the fit rect (the letterbox margin)', () => {
    const wideFit = computeLetterboxFit(1000, 400, GRID_WIDTH, GRID_HEIGHT)
    const cell = canvasPointToGrid(wideFit, GRID_WIDTH, GRID_HEIGHT, 5, 5)
    expect(cell).toBeNull()
  })

  it('returns null for a zero-area fit rect', () => {
    const zeroFit = computeLetterboxFit(0, 0, GRID_WIDTH, GRID_HEIGHT)
    expect(canvasPointToGrid(zeroFit, GRID_WIDTH, GRID_HEIGHT, 0, 0)).toBeNull()
  })
})
