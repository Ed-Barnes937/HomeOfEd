import { describe, expect, it } from 'vitest'

import { parseLlamaGuardResponse } from './safety-classifier.ts'

describe('R3 Llama Guard parsing (6.5.2)', () => {
  it("treats a 'safe' verdict as safe", () => {
    const result = parseLlamaGuardResponse('safe')
    expect(result.safe).toBe(true)
    expect(result.categories).toEqual([])
  })

  it("treats 'unsafe' + category codes as unsafe and captures the categories", () => {
    const result = parseLlamaGuardResponse('unsafe\nS1,S11')
    expect(result.safe).toBe(false)
    expect(result.categories).toEqual(['S1', 'S11'])
    expect(result.reason).toContain('S1')
  })

  it("captures category codes when returned on the same line as 'unsafe'", () => {
    const result = parseLlamaGuardResponse('unsafe S1')
    expect(result.safe).toBe(false)
    expect(result.categories).toEqual(['S1'])
    expect(result.reason).toContain('S1')
  })

  it("handles 'unsafe' with no category line", () => {
    const result = parseLlamaGuardResponse('unsafe')
    expect(result.safe).toBe(false)
    expect(result.categories).toEqual([])
  })

  it('fails closed (unsafe) on an unparseable verdict', () => {
    const result = parseLlamaGuardResponse('I think this might be okay?')
    expect(result.safe).toBe(false)
    expect(result.reason).toContain('unparseable')
  })

  it('ignores surrounding whitespace and case', () => {
    expect(parseLlamaGuardResponse('  SAFE  ').safe).toBe(true)
    expect(parseLlamaGuardResponse('\nUnsafe\nS2\n').safe).toBe(false)
  })
})
