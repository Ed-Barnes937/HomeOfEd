import { describe, expect, it } from 'vitest'

import { knobRotation, snapRotation, wheelRotation } from './rotation.ts'

describe('knobRotation', () => {
  const cx = 100
  const cy = 100

  it('reads 0° when the pointer is straight up', () => {
    expect(knobRotation(cx, cy, 100, 50)).toBeCloseTo(0)
  })
  it('reads 90° when the pointer is to the right', () => {
    expect(knobRotation(cx, cy, 150, 100)).toBeCloseTo(90)
  })
  it('reads 180° when the pointer is straight down', () => {
    expect(knobRotation(cx, cy, 100, 150)).toBeCloseTo(180)
  })
  it('reads 270° when the pointer is to the left', () => {
    expect(knobRotation(cx, cy, 50, 100)).toBeCloseTo(270)
  })
})

describe('snapRotation', () => {
  it('snaps to the nearest 90 when the delta is < within (6° snaps)', () => {
    expect(snapRotation(6)).toBe(0)
    expect(snapRotation(93)).toBe(90)
  })

  it('does NOT snap exactly at the within boundary (7° stays, strict <)', () => {
    expect(snapRotation(7)).toBe(7)
  })

  it('normalises to [0,360) before deciding, snap or not', () => {
    expect(snapRotation(-50)).toBe(310) // nearest 270 is 40° away → unsnapped
  })

  it('wraps a near-360 value down to 0 (near % 360)', () => {
    expect(snapRotation(359)).toBe(0)
  })
})

describe('wheelRotation', () => {
  it('adds a step for positive deltaY', () => {
    expect(wheelRotation(10, 5)).toBe(17)
  })
  it('subtracts a step for negative deltaY', () => {
    expect(wheelRotation(10, -5)).toBe(3)
  })
  it('is a no-op at deltaY === 0 (documented divergence from the prototype)', () => {
    expect(wheelRotation(10, 0)).toBe(10)
  })
})
