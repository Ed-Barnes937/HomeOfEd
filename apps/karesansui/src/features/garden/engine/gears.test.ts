import { describe, expect, it } from 'vitest'

import {
  fullTurns,
  gcd,
  gearPalette,
  lcm,
  MAX_GEARS,
  prettyTurns,
  ringOpts,
  shade,
  wheelOpts,
} from './gears.ts'

describe('options / constants', () => {
  it('exposes the reference ring and wheel option sets', () => {
    expect(ringOpts()).toEqual([96, 120, 144])
    expect(wheelOpts()).toEqual([24, 30, 36, 45, 52, 63])
    expect(MAX_GEARS).toBe(3)
  })
})

describe('gcd / lcm', () => {
  it('computes gcd on known pairs', () => {
    expect(gcd(96, 52)).toBe(4)
    expect(gcd(120, 45)).toBe(15)
    expect(gcd(17, 5)).toBe(1)
    expect(gcd(0, 9)).toBe(9)
  })

  it('is sign-insensitive', () => {
    expect(gcd(-96, 52)).toBe(4)
  })

  it('computes lcm on known pairs', () => {
    expect(lcm(4, 6)).toBe(12)
    expect(lcm(13, 1)).toBe(13)
    expect(lcm(3, 5)).toBe(15)
  })
})

describe('fullTurns', () => {
  it('matches the LCM-of-reduced-ratios formula', () => {
    // gcd(96,52)=4 → 52/4=13 → lcm(1,13)=13
    expect(fullTurns(96, [52])).toBe(13)
    // gcd(120,45)=15 → 45/15=3 → lcm(1,3)=3
    expect(fullTurns(120, [45])).toBe(3)
  })

  it('combines multiple wheels by LCM of their reduced ratios', () => {
    // 96/[52,45]: 52→13, 45: gcd(96,45)=3 → 15; lcm(13,15)=195
    expect(fullTurns(96, [52, 45])).toBe(195)
    // 144/[24]: gcd=24 → 1 → clamps up to 1
    expect(fullTurns(144, [24])).toBe(1)
  })

  it('clamps to [1, 200]', () => {
    expect(fullTurns(144, [24])).toBeGreaterThanOrEqual(1)
    // 120/[52,63]: 52: gcd(120,52)=4→13; 63: gcd(120,63)=3→21; lcm(13,21)=273 → clamp 200
    expect(fullTurns(120, [52, 63])).toBe(200)
  })
})

describe('prettyTurns', () => {
  it('caps at 40', () => {
    expect(prettyTurns(96, [52, 45])).toBe(40) // full 195 → 40
    expect(prettyTurns(120, [52, 63])).toBe(40) // full 200 → 40
  })

  it('passes through when the full count is under 40', () => {
    expect(prettyTurns(96, [52])).toBe(13)
    expect(prettyTurns(120, [45])).toBe(3)
  })
})

describe('gearPalette', () => {
  it('returns the known pair for each wheel size', () => {
    expect(gearPalette(24)).toEqual(['#57c2b8', '#2f877f'])
    expect(gearPalette(30)).toEqual(['#a7bd72', '#6d8038'])
    expect(gearPalette(36)).toEqual(['#f0c85a', '#c99a2c'])
    expect(gearPalette(45)).toEqual(['#f0906d', '#d1553a'])
    expect(gearPalette(52)).toEqual(['#c88bb0', '#8a5a7a'])
    expect(gearPalette(63)).toEqual(['#d8a56a', '#9c6b3f'])
  })

  it('falls back to the neutral tan for an unknown value', () => {
    expect(gearPalette(999)).toEqual(['#d8a56a', '#9c6b3f'])
  })
})

describe('shade', () => {
  it('lightens and darkens channels', () => {
    expect(shade('#804020', 16)).toBe('rgb(144,80,48)')
    expect(shade('#804020', -16)).toBe('rgb(112,48,16)')
  })

  it('clamps channels to 0-255', () => {
    expect(shade('#ffffff', 100)).toBe('rgb(255,255,255)')
    expect(shade('#000000', -100)).toBe('rgb(0,0,0)')
  })
})
