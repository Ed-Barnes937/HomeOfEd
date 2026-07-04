import { describe, expect, it } from 'vitest'

import { generateStars } from './backdrop.ts'

describe('generateStars', () => {
  it('is deterministic for a given size and seed', () => {
    expect(generateStars(800, 600)).toEqual(generateStars(800, 600))
    expect(generateStars(800, 600, 7)).toEqual(generateStars(800, 600, 7))
  })

  it('varies with the seed', () => {
    expect(generateStars(800, 600, 1)).not.toEqual(generateStars(800, 600, 2))
  })

  it('scales the star count with viewport area', () => {
    const small = generateStars(400, 300)
    const large = generateStars(800, 600)
    expect(large.length).toBeGreaterThan(small.length)
  })

  it('keeps every star inside the viewport with a visible radius and alpha', () => {
    for (const star of generateStars(640, 480)) {
      expect(star.x).toBeGreaterThanOrEqual(0)
      expect(star.x).toBeLessThanOrEqual(640)
      expect(star.y).toBeGreaterThanOrEqual(0)
      expect(star.y).toBeLessThanOrEqual(480)
      expect(star.r).toBeGreaterThan(0)
      expect(star.a).toBeGreaterThan(0)
      expect(star.a).toBeLessThanOrEqual(1)
    }
  })

  it('returns nothing for a zero-area viewport', () => {
    expect(generateStars(0, 600)).toEqual([])
  })
})
