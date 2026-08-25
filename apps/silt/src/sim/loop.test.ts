import { describe, expect, it } from 'vitest'

import { FixedTimestep } from './loop.ts'

describe('FixedTimestep', () => {
  it('runs one step per elapsed step interval and keeps the remainder', () => {
    const timestep = new FixedTimestep(10)
    let steps = 0

    expect(timestep.advance(25, () => steps++)).toBe(2)
    expect(timestep.advance(5, () => steps++)).toBe(1)
    expect(steps).toBe(3)
  })

  it('caps a long stall instead of spiralling', () => {
    const timestep = new FixedTimestep(10, 4)

    expect(timestep.advance(10_000, () => {})).toBe(4)
    expect(timestep.advance(10, () => {})).toBe(1)
  })
})
