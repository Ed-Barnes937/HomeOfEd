import { describe, expect, it } from 'vitest'

import { srgbToLinear } from '../items/colour.ts'
import { swordSchema } from '../sword/swordSchema.ts'
import { BLOOM_THRESHOLD } from './stage.ts'
import {
  dyeFor,
  FITTINGS,
  GRIP_DYES,
  LEATHER_BASE,
  PATTERNS,
  REST_CAP,
  STEELS,
} from './swordMaterials.ts'

const optionsOf = (key: string) => {
  const param = swordSchema.params.find((p) => p.key === key)
  if (param?.kind !== 'choice') throw new Error(`${key} is not a choice`)
  return param.options
}

const inUnit = (n: number) => n >= 0 && n <= 1

describe('sword material tables', () => {
  it('has a steel row for every steel, in range', () => {
    for (const { value } of optionsOf('steel')) {
      const row = STEELS[value as keyof typeof STEELS]
      expect(row, value).toBeDefined()
      expect(row.colour.every(inUnit), value).toBe(true)
      expect(inUnit(row.roughness) && inUnit(row.metalness) && inUnit(row.anisotropy), value).toBe(
        true,
      )
      expect(row.envIntensity, value).toBeGreaterThan(0)
    }
  })

  it('keeps a bright bare edge on black and blue steel', () => {
    expect(STEELS.dark.bareEdge).toBe(true)
    expect(STEELS.blue.bareEdge).toBe(true)
    expect(STEELS.satin.bareEdge).toBe(false)
  })

  it('has a pattern row for every pattern, in range', () => {
    for (const { value } of optionsOf('pattern')) {
      const row = PATTERNS[value as keyof typeof PATTERNS]
      expect(row, value).toBeDefined()
      expect([...row.light, ...row.dark].every(inUnit), value).toBe(true)
      expect(row.roughness.every(inUnit), value).toBe(true)
    }
    expect(PATTERNS.plain.mix).toBe(0)
  })

  it('has a fittings row for every fittings metal, in range', () => {
    for (const { value } of optionsOf('fittings')) {
      const row = FITTINGS[value as keyof typeof FITTINGS]
      expect(row, value).toBeDefined()
      expect(row.colour.every(inUnit), value).toBe(true)
      expect(inUnit(row.roughness) && inUnit(row.metalness), value).toBe(true)
    }
  })

  it('dyes the pale leather onto every grip swatch, and leaves undyed alone', () => {
    for (const { value, swatch } of optionsOf('gripColour')) {
      const dye = GRIP_DYES[value]
      expect(dye, value).toBeDefined()
      expect(
        dye!.every((a) => a >= 0),
        value,
      ).toBe(true)
      const dyed = LEATHER_BASE.map((c, i) => c * Math.exp(-dye![i]!))
      srgbToLinear(swatch!).forEach((c, i) => expect(dyed[i]).toBeCloseTo(c, 4))
    }
    expect(GRIP_DYES.undyed).toEqual([0, 0, 0])
    expect(dyeFor(srgbToLinear('#c7a77c'))).toEqual([0, 0, 0])
  })

  it('caps everything at rest below the bloom', () => {
    expect(REST_CAP).toBeCloseTo(0.92 * BLOOM_THRESHOLD)
  })
})
