import { describe, expect, it } from 'vitest'

import { clampParams, DEFAULT_PARAMS, PARAM_RANGES, type SimParams } from './params.ts'

describe('PARAM_RANGES / DEFAULT_PARAMS', () => {
  it('matches the design handoff spec exactly (count max raised to 1000 per spec §4)', () => {
    expect(PARAM_RANGES).toEqual({
      count: { min: 20, max: 1000, step: 1 },
      speed: { min: 0.5, max: 6, step: 0.1 },
      separation: { min: 0, max: 3, step: 0.05 },
      alignment: { min: 0, max: 3, step: 0.05 },
      cohesion: { min: 0, max: 3, step: 0.05 },
      vision: { min: 20, max: 140, step: 1 },
      trail: { min: 0, max: 1, step: 0.01 },
    })
    expect(DEFAULT_PARAMS).toEqual({
      count: 150,
      speed: 2.6,
      separation: 1.3,
      alignment: 1.0,
      cohesion: 0.9,
      vision: 66,
      trail: 0.42,
    })
  })
})

describe('clampParams', () => {
  it('passes through values already in range', () => {
    expect(clampParams(DEFAULT_PARAMS)).toEqual(DEFAULT_PARAMS)
  })

  it('clamps out-of-range values to the nearest bound', () => {
    expect(clampParams({ ...DEFAULT_PARAMS, count: 2500, vision: 1 })).toEqual({
      ...DEFAULT_PARAMS,
      count: 1000,
      vision: 20,
    })
    expect(clampParams({ ...DEFAULT_PARAMS, separation: -5 })).toEqual({
      ...DEFAULT_PARAMS,
      separation: 0,
    })
  })

  it('falls back to the default for missing or non-numeric values', () => {
    expect(clampParams({})).toEqual(DEFAULT_PARAMS)
    const garbage: Partial<Record<keyof SimParams, unknown>> = { count: 'lots', vision: null }
    expect(clampParams(garbage)).toEqual(DEFAULT_PARAMS)
  })

  it('falls back to the default for NaN/Infinity', () => {
    expect(clampParams({ ...DEFAULT_PARAMS, speed: NaN, trail: Infinity })).toEqual({
      ...DEFAULT_PARAMS,
      trail: DEFAULT_PARAMS.trail,
      speed: DEFAULT_PARAMS.speed,
    })
  })

  it('ignores unknown keys', () => {
    const withBogus: Record<string, unknown> = { ...DEFAULT_PARAMS, bogus: 42 }
    const result = clampParams(withBogus)
    expect(result).toEqual(DEFAULT_PARAMS)
    expect(Object.keys(result)).not.toContain('bogus')
  })
})
