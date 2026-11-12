import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { compileSword } from '../sword/compile.ts'
import { swordGemPoses } from '../sword/geometry.ts'
import { swordSchema } from '../sword/swordSchema.ts'
import { BLOOM_THRESHOLD } from './stage.ts'
import {
  GLINT,
  GLOW_CEILING,
  glintEdge,
  GLOW_SECONDS,
  presentedFace,
  presentWeight,
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

  it('lets the gems catch the light as the glint leaves the guard, then glow with the wake', () => {
    const samples = run()
    const caught = samples.filter(({ glow }) => glow.gems > 0.99)
    expect(caught[0]!.t).toBeGreaterThanOrEqual(GLINT.from)
    expect(caught[0]!.t).toBeLessThan(GLINT.from + GLINT.seconds / 2)
    for (const { glow } of samples) {
      expect(glow.gems).toBeGreaterThanOrEqual(0)
      expect(glow.gems).toBeLessThanOrEqual(1)
    }
    expect(SWORD_REST.gems).toBe(0)
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
      expect(Math.abs(b.gems - a.gems)).toBeLessThan(0.2)
      expect(Math.abs(b.runes - a.runes)).toBeLessThan(0.1 * (RUNE_PEAK - SWORD_REST.runes))
      expect(Math.abs(b.cap - a.cap)).toBeLessThan(0.1 * (GLOW_CEILING - REST_CAP))
    }
  })

  it('holds still with reduced motion', () => {
    for (const { t } of run()) expect(swordGlow(t, true, 0)).toEqual(SWORD_REST)
  })

  it('turns the flat to the viewer for the glint and the wake, then lets go after the peak of the wake', () => {
    for (const t of [-1, 0, 1, 2, GLOW_SECONDS, 30]) expect(presentWeight(t, false)).toBe(0)
    for (const t of [GLINT.from, GLINT.from + GLINT.seconds, GLINT.from + 1.2])
      expect(presentWeight(t, false)).toBe(1)
    for (let i = 1; i < times.length; i++)
      expect(
        Math.abs(presentWeight(times[i]!, false) - presentWeight(times[i - 1]!, false)),
      ).toBeLessThan(0.05)
    for (const t of times) expect(presentWeight(t, true)).toBe(0)
  })
})

const sword = (raw: Record<string, unknown>) => compileSword(normalise(swordSchema, raw))

describe('which edge glints and which face is shown', () => {
  it('lights only the cutting edge of a single-edged blade, even where its back is sharpened', () => {
    expect(glintEdge(sword({ family: 'sabre', profile: 'flared' }))).toBe('cutting')
    expect(glintEdge(sword({ family: 'sabre' }))).toBe('cutting')
    expect(glintEdge(sword({ family: 'katana' }))).toBe('cutting')
  })

  it('lights the edge toward the window on a two-edged blade', () => {
    for (const family of ['dagger', 'knight', 'greatsword', 'rapier'])
      expect(glintEdge(sword({ family }))).toBe('toward window')
  })

  it('turns a gem set in one face toward the viewer, and lets a sword without one show either face', () => {
    expect(presentedFace(sword({ family: 'knight', gems: 'none' }))).toBe(0)
    const gemmed = sword({ family: 'knight', gems: 'pommel' })
    const [pose] = swordGemPoses(gemmed)
    expect(presentedFace(gemmed)).toBe(Math.sign(pose!.normal[1]))
    expect(presentedFace(gemmed)).not.toBe(0)
  })
})
