import { describe, expect, it } from 'vitest'

import { GEM_REST, gemGlow } from './gemGlow.ts'
import { BLOOM_THRESHOLD, SPELL_SECONDS } from './stage.ts'

describe('gem glow', () => {
  it('glows faintly at rest, below the bloom', () => {
    expect(gemGlow(Infinity, false)).toEqual(GEM_REST)
    expect(gemGlow(-1, false)).toEqual(GEM_REST)
    expect(GEM_REST.emissive).toBeGreaterThan(0)
    expect(GEM_REST.cap).toBeLessThan(BLOOM_THRESHOLD)
  })

  it('flares past the bloom as the spell leaves the tip, then settles by its end', () => {
    const flare = gemGlow(0, false)
    expect(flare.emissive).toBeGreaterThan(4 * GEM_REST.emissive)
    expect(flare.cap).toBeGreaterThan(BLOOM_THRESHOLD)
    expect(gemGlow(0.5, false).emissive).toBeLessThan(flare.emissive)
    expect(gemGlow(0.5, false).emissive).toBeGreaterThan(GEM_REST.emissive)
    expect(gemGlow(SPELL_SECONDS, false)).toEqual(GEM_REST)
  })

  it('holds a steady glow with reduced motion', () => {
    for (const t of [-1, 0, 0.2, 1, SPELL_SECONDS, Infinity])
      expect(gemGlow(t, true)).toEqual(GEM_REST)
  })
})
