import { describe, expect, it } from 'vitest'

import { strokeSteps } from './strokeSteps.ts'

describe('strokeSteps', () => {
  it('no movement means no steps', () => {
    expect(strokeSteps({ x: 5, y: 5 }, { x: 5, y: 5 }, 1)).toEqual([])
  })

  it('one cell of movement is a single step landing on the target', () => {
    expect(strokeSteps({ x: 5, y: 5 }, { x: 6, y: 5 }, 1)).toEqual([{ x: 6, y: 5 }])
  })

  it('a long horizontal jump with a 1-wide brush stamps every cell up to the target', () => {
    const steps = strokeSteps({ x: 0, y: 10 }, { x: 10, y: 10 }, 1)
    expect(steps).toEqual(
      Array.from({ length: 10 }, (_, i) => ({ x: i + 1, y: 10 })),
    )
  })

  it('a diagonal jump leaves no gap: consecutive steps touch (Chebyshev <= 1) and end on the target', () => {
    const from = { x: 3, y: 4 }
    const to = { x: 40, y: 27 }
    const steps = strokeSteps(from, to, 3)
    expect(steps.at(-1)).toEqual(to)
    let prev = from
    for (const step of steps) {
      expect(Math.abs(step.x - prev.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(step.y - prev.y)).toBeLessThanOrEqual(1)
      prev = step
    }
  })

  it('a wider brush stamps less densely but its footprints still overlap', () => {
    const from = { x: 0, y: 0 }
    const to = { x: 14, y: 0 }
    const narrow = strokeSteps(from, to, 1)
    const wide = strokeSteps(from, to, 7)
    expect(wide.length).toBeLessThan(narrow.length)
    expect(wide.at(-1)).toEqual(to)
    // Footprint radius is width/2 = 3.5 cells; gaps stay well inside it.
    let prev = from
    for (const step of wide) {
      expect(Math.abs(step.x - prev.x)).toBeLessThanOrEqual(2)
      prev = step
    }
  })

  it('direction does not matter', () => {
    const forward = strokeSteps({ x: 0, y: 0 }, { x: 10, y: 0 }, 1)
    const backward = strokeSteps({ x: 10, y: 0 }, { x: 0, y: 0 }, 1)
    expect(backward).toHaveLength(forward.length)
    expect(backward.at(-1)).toEqual({ x: 0, y: 0 })
  })
})
