import { describe, expect, it } from 'vitest'

import { SpatialHash } from './spatialHash.ts'

function build(cellSize: number, width: number, height: number, points: [number, number][]) {
  const hash = new SpatialHash(cellSize, width, height)
  points.forEach(([x, y], i) => hash.insert(i, x, y))
  return hash
}

describe('SpatialHash', () => {
  it('returns exactly the points within radius of the query point', () => {
    const hash = build(20, 200, 200, [
      [50, 50], // index 0: distance 0
      [55, 50], // index 1: distance 5 — in
      [65, 50], // index 2: distance 15 — out at radius 10
      [50, 58], // index 3: distance 8 — in
      [150, 150], // index 4: far away — out
    ])
    const found = hash.queryRadius(50, 50, 10).sort()
    expect(found).toEqual([0, 1, 3])
  })

  it('excludes points exactly on the boundary radius correctly (inclusive)', () => {
    const hash = build(20, 200, 200, [[60, 50]])
    expect(hash.queryRadius(50, 50, 10)).toEqual([0])
    expect(hash.queryRadius(50, 50, 9.999)).toEqual([])
  })

  it('finds neighbours across the toroidal wrap boundary', () => {
    // World is 100x100. A point at x=2 and a point at x=98 are only 4 apart
    // when wrapped, even though 96 apart in a straight line.
    const hash = build(20, 100, 100, [
      [98, 50], // index 0
      [2, 50], // index 1 — wraps to be close to index 0
    ])
    expect(hash.queryRadius(98, 50, 10).sort()).toEqual([0, 1])
    expect(hash.queryRadius(2, 50, 10).sort()).toEqual([0, 1])
  })

  it('wraps on the y axis too', () => {
    const hash = build(20, 100, 100, [
      [50, 99],
      [50, 1],
    ])
    expect(hash.queryRadius(50, 99, 5).sort()).toEqual([0, 1])
  })

  it('returns an empty array when nothing is in range', () => {
    const hash = build(20, 200, 200, [[190, 190]])
    expect(hash.queryRadius(10, 10, 5)).toEqual([])
  })

  it('clear() removes all previously inserted points', () => {
    const hash = build(20, 200, 200, [[50, 50]])
    hash.clear()
    expect(hash.queryRadius(50, 50, 10)).toEqual([])
  })

  describe('queryRadiusInto', () => {
    it('fills the out array with the same matches queryRadius returns', () => {
      const hash = build(20, 200, 200, [
        [50, 50],
        [55, 50],
        [65, 50],
        [50, 58],
        [150, 150],
      ])
      const out: number[] = []
      const found = hash.queryRadiusInto(50, 50, 10, out)
      expect(found).toBe(3)
      expect([...out].sort()).toEqual([0, 1, 3])
    })

    it('truncates stale entries left over from a previous, larger query', () => {
      const hash = build(20, 200, 200, [
        [50, 50],
        [55, 50],
        [190, 190],
      ])
      const out: number[] = []
      hash.queryRadiusInto(50, 50, 10, out)
      expect(out).toHaveLength(2)
      const found = hash.queryRadiusInto(190, 190, 5, out)
      expect(found).toBe(1)
      expect(out).toEqual([2])
    })
  })
})
