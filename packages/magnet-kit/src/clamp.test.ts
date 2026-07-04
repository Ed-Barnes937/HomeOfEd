import { describe, expect, it } from 'vitest'

import { clampOne } from './clamp.ts'
import type { Box } from './types.ts'

const box = (over: Partial<Box>): Box => ({ id: 1, x: 0, y: 0, w: 50, h: 60, ...over })

describe('clampOne', () => {
  it('clamps x below the left edge to 0', () => {
    const b = box({ x: -20 })
    clampOne(b, 600, 400)
    expect(b.x).toBe(0)
  })

  it('clamps x past the right edge to boundsW - w', () => {
    const b = box({ x: 999 })
    clampOne(b, 600, 400)
    expect(b.x).toBe(600 - 50)
  })

  it('clamps y above the top edge to 0', () => {
    const b = box({ y: -20 })
    clampOne(b, 600, 400)
    expect(b.y).toBe(0)
  })

  it('clamps y past the bottom edge to boundsH - h', () => {
    const b = box({ y: 999 })
    clampOne(b, 600, 400)
    expect(b.y).toBe(400 - 60)
  })

  it('leaves an in-bounds box untouched', () => {
    const b = box({ x: 100, y: 100 })
    clampOne(b, 600, 400)
    expect(b).toMatchObject({ x: 100, y: 100 })
  })
})
