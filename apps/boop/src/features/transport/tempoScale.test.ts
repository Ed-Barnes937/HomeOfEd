import { describe, expect, it } from 'vitest'

import { bpmToPercent, percentToBpm } from './tempoScale.ts'

describe('bpmToPercent', () => {
  it('maps the slow endpoint to 0%', () => {
    expect(bpmToPercent(60)).toBe(0)
  })

  it('maps the fast endpoint to 100%', () => {
    expect(bpmToPercent(200)).toBe(100)
  })

  it('maps the default 100 bpm to ~42%, per the design handoff', () => {
    expect(Math.round(bpmToPercent(100))).toBe(42)
  })
})

describe('percentToBpm', () => {
  it('maps 0% to the slow endpoint', () => {
    expect(percentToBpm(0)).toBe(60)
  })

  it('maps 100% to the fast endpoint', () => {
    expect(percentToBpm(100)).toBe(200)
  })

  it('maps ~42% back to the default 100 bpm', () => {
    expect(percentToBpm(bpmToPercent(100))).toBe(100)
  })

  it('rounds to an integer bpm', () => {
    const bpm = percentToBpm(50)
    expect(Number.isInteger(bpm)).toBe(true)
  })

  it('clamps out-of-range percentages', () => {
    expect(percentToBpm(-10)).toBe(60)
    expect(percentToBpm(110)).toBe(200)
  })
})

describe('round-trip', () => {
  it('recovers the same integer bpm across the middle of the range', () => {
    for (const bpm of [60, 75, 90, 100, 120, 150, 180, 200]) {
      expect(percentToBpm(bpmToPercent(bpm))).toBe(bpm)
    }
  })
})
