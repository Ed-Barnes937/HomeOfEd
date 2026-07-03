import { describe, expect, it } from 'vitest'

import { add, limit, magnitude, scale, setMagnitude, sub } from './vector.ts'

describe('vector', () => {
  it('adds two vectors', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: -1 })).toEqual({ x: 4, y: 1 })
  })

  it('subtracts two vectors', () => {
    expect(sub({ x: 1, y: 2 }, { x: 3, y: -1 })).toEqual({ x: -2, y: 3 })
  })

  it('scales a vector', () => {
    expect(scale({ x: 2, y: -3 }, 2.5)).toEqual({ x: 5, y: -7.5 })
  })

  it('computes magnitude', () => {
    expect(magnitude({ x: 3, y: 4 })).toBe(5)
    expect(magnitude({ x: 0, y: 0 })).toBe(0)
  })

  describe('limit', () => {
    it('leaves a vector under the max unchanged', () => {
      expect(limit({ x: 3, y: 4 }, 10)).toEqual({ x: 3, y: 4 })
    })

    it('clamps a vector over the max to that magnitude, preserving direction', () => {
      const result = limit({ x: 3, y: 4 }, 2.5)
      expect(magnitude(result)).toBeCloseTo(2.5)
      expect(result.x / result.y).toBeCloseTo(3 / 4)
    })

    it('leaves the zero vector unchanged', () => {
      expect(limit({ x: 0, y: 0 }, 5)).toEqual({ x: 0, y: 0 })
    })
  })

  describe('setMagnitude', () => {
    it('scales a vector to the given magnitude, preserving direction', () => {
      const result = setMagnitude({ x: 3, y: 4 }, 10)
      expect(magnitude(result)).toBeCloseTo(10)
      expect(result.x / result.y).toBeCloseTo(3 / 4)
    })

    it('returns the zero vector for zero input regardless of target magnitude', () => {
      expect(setMagnitude({ x: 0, y: 0 }, 10)).toEqual({ x: 0, y: 0 })
    })
  })
})
