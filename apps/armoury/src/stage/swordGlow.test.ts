import { describe, expect, it } from 'vitest'

import { BLOOM_THRESHOLD } from './stage.ts'
import {
  GLINT,
  GLOW_CEILING,
  GLOW_SECONDS,
  RUNE_PEAK,
  SWORD_REST,
  swordGlow,
  type SwordGlow,
} from './swordGlow.ts'
import { REST_CAP } from './swordMaterials.ts'

const FRAME = 1 / 60
const times = Array.from({ length: Math.ceil(12 / FRAME) }, (_, i) => -1 + i * FRAME)
const run = (wakeFrom: number | null = 0.2) =>
  times.map((t) => ({ t, glow: swordGlow(t, false, wakeFrom) }))
const atRest = (g: SwordGlow) => g.glintAt === null && g.runes === SWORD_REST.runes

describe('the sword glow', () => {
  it('is at rest before the first flourish, as it starts, and long after', () => {
    for (const t of [-1, 0, 1, 30, Infinity]) expect(swordGlow(t, false, 0)).toEqual(SWORD_REST)
    expect(SWORD_REST.cap).toBe(REST_CAP)
    expect(SWORD_REST.glint).toBe(0)
    expect(swordGlow(GLOW_SECONDS, false, 1)).toEqual(SWORD_REST)
  })

  it('runs one glint up the edge, guard to tip, only once the 8 has closed', () => {
    const lit = run().filter(({ glow }) => glow.glintAt !== null)
    const first = lit[0]!.t
    const last = lit[lit.length - 1]!.t
    expect(first).toBeGreaterThanOrEqual(GLINT.from)
    expect(GLINT.from).toBeCloseTo(3.75, 6)
    expect(last - first).toBeLessThanOrEqual(0.7)
    expect(lit.length).toBe(Math.round((last - first) / FRAME) + 1)
    const at = lit.map(({ glow }) => glow.glintAt!)
    for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThanOrEqual(at[i - 1]!)
    expect(at[0]).toBeLessThan(0.05)
    expect(at[at.length - 1]).toBeGreaterThan(0.95)
    for (const { glow } of run()) if (glow.glintAt === null) expect(glow.glint).toBe(0)
  })

  it('lets the glint past the bloom only while it runs, and never past the ceiling', () => {
    const peak = Math.max(...run().map(({ glow }) => glow.cap))
    expect(peak).toBeGreaterThanOrEqual(1.5 * BLOOM_THRESHOLD)
    expect(peak).toBeLessThanOrEqual(GLOW_CEILING)
    expect(GLOW_CEILING).toBeLessThanOrEqual(2 * BLOOM_THRESHOLD)
    for (const { glow } of run()) if (atRest(glow)) expect(glow.cap).toBe(REST_CAP)
  })

  it('wakes the runes as the glint passes them, up to their peak, then settles them to rest', () => {
    const wakeFrom = 0.4
    const samples = run(wakeFrom)
    const woken = samples.filter(({ glow }) => glow.runes > SWORD_REST.runes)
    expect(woken[0]!.t).toBeGreaterThanOrEqual(GLINT.from + wakeFrom * GLINT.seconds)
    const highest = Math.max(...woken.map(({ glow }) => glow.runes))
    expect(highest).toBeCloseTo(RUNE_PEAK, 2)
    expect(RUNE_PEAK).toBeGreaterThanOrEqual(1.2 * BLOOM_THRESHOLD)
    expect(RUNE_PEAK).toBeLessThanOrEqual(1.4 * BLOOM_THRESHOLD)
    expect(woken[woken.length - 1]!.t).toBeLessThan(GLOW_SECONDS)
    for (const { glow } of samples) expect(glow.runes).toBeGreaterThanOrEqual(SWORD_REST.runes)
  })

  it('gives a sword without runes or gems the glint alone', () => {
    const samples = run(null)
    for (const { glow } of samples) expect(glow.runes).toBe(SWORD_REST.runes)
    expect(samples.some(({ glow }) => glow.glint > 0.9)).toBe(true)
  })

  it('never jumps from one frame to the next', () => {
    const samples = run()
    for (let i = 1; i < samples.length; i++) {
      const [a, b] = [samples[i - 1]!.glow, samples[i]!.glow]
      expect(Math.abs(b.glint - a.glint)).toBeLessThan(0.1)
      expect(Math.abs(b.runes - a.runes)).toBeLessThan(0.1 * (RUNE_PEAK - SWORD_REST.runes))
      expect(Math.abs(b.cap - a.cap)).toBeLessThan(0.1 * (GLOW_CEILING - REST_CAP))
    }
  })

  it('holds still with reduced motion', () => {
    for (const { t } of run()) expect(swordGlow(t, true, 0)).toEqual(SWORD_REST)
  })
})
