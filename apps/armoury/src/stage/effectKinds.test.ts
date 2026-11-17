import { describe, expect, it } from 'vitest'

import { EFFECTS, type PotionEffect } from '../potion/effects.ts'
import {
  EFFECT_BOX,
  EFFECT_SECONDS,
  EFFECT_STILL_AGE,
  effectCount,
  effectParticle,
  effectReach,
  effectSeed,
  type Frame,
  MAX_POINTS,
  MAX_SMOKE,
  newParticle,
  type Particle,
  placeParticle,
  REACH,
  SHAPES,
} from './effectKinds.ts'

type Kind = PotionEffect['kind']
type Strength = PotionEffect['strength']

const FRAME = 1 / 60
const KINDS = Object.keys(EFFECTS) as Kind[]
const STRENGTHS: Strength[] = [1, 2, 3]
const SEEDS = [1, effectSeed('moonmilk,rosehip,starpetal')]
const AGES = Array.from({ length: Math.ceil(EFFECT_SECONDS / FRAME) + 1 }, (_, f) => f * FRAME)

const each = (visit: (kind: Kind, strength: Strength, seed: number) => void) => {
  for (const kind of KINDS)
    for (const strength of STRENGTHS) for (const seed of SEEDS) visit(kind, strength, seed)
}

const at = (kind: Kind, seed: number, i: number, age: number, strength: Strength): Particle =>
  effectParticle(kind, seed, i, age, strength, newParticle())

const shown = (kind: Kind, seed: number, age: number, strength: Strength) =>
  Array.from({ length: effectCount(kind, strength) }, (_, i) =>
    at(kind, seed, i, age, strength),
  ).filter((p) => p.alpha > 0)

describe('the effect programs', () => {
  it('know every outcome a mix can have', () => {
    expect(KINDS).toHaveLength(7)
    for (const kind of KINDS) expect(effectCount(kind, 1)).toBeGreaterThan(0)
  })

  it('keep every particle in the box above the neck for the whole show', () => {
    const outside: string[] = []
    each((kind, strength, seed) => {
      const p = newParticle()
      for (const age of AGES)
        for (let i = 0; i < effectCount(kind, strength); i++) {
          effectParticle(kind, seed, i, age, strength, p)
          if (p.alpha <= 0) continue
          const inside =
            Math.abs(p.x) <= EFFECT_BOX.side &&
            p.y <= EFFECT_BOX.up &&
            p.y >= -EFFECT_BOX.down &&
            Math.abs(p.z) <= EFFECT_BOX.depth
          if (!inside)
            outside.push(`${kind} ${strength} #${i} at ${age.toFixed(3)}: ${p.x}, ${p.y}, ${p.z}`)
        }
    })
    expect(outside.slice(0, 5)).toEqual([])
  })

  it('keep counts, sizes and brightness within bounds', () => {
    const shapes: number[] = Object.values(SHAPES)
    const wrong: string[] = []
    each((kind, strength, seed) => {
      const n = effectCount(kind, strength)
      expect(n).toBeLessThanOrEqual(MAX_POINTS)
      const smoke = new Set<number>()
      const p = newParticle()
      for (const age of AGES)
        for (let i = 0; i < n; i++) {
          effectParticle(kind, seed, i, age, strength, p)
          const fine =
            p.alpha >= 0 &&
            p.alpha <= 1 &&
            (p.alpha === 0 || (p.size > 0 && p.size <= 1 && shapes.includes(p.shape)))
          if (!fine)
            wrong.push(`${kind} ${strength} #${i} at ${age.toFixed(3)}: ${JSON.stringify(p)}`)
          if (p.alpha > 0 && p.shape === SHAPES.smoke) smoke.add(i)
        }
      expect(smoke.size).toBeLessThanOrEqual(MAX_SMOKE)
      if (kind !== 'whiffy') expect(smoke.size).toBe(0)
    })
    expect(wrong.slice(0, 5)).toEqual([])
  })

  it('grow with strength', () => {
    for (const kind of KINDS) {
      const [one, two, three] = STRENGTHS.map((s) => effectCount(kind, s)) as [
        number,
        number,
        number,
      ]
      expect(two).toBeGreaterThanOrEqual(one)
      expect(three).toBeGreaterThanOrEqual(two)
      if (kind !== 'murky') expect(three).toBeGreaterThan(one)
    }
  })

  it('show nothing before the pop, and are gone before the stopper sets off back', () => {
    each((kind, strength, seed) => {
      for (const age of [-1, -FRAME, EFFECT_SECONDS, EFFECT_SECONDS + FRAME, EFFECT_SECONDS + 30])
        expect(shown(kind, seed, age, strength), `${kind} at ${age}`).toHaveLength(0)
      expect(shown(kind, seed, EFFECT_SECONDS - 0.04, strength)).toHaveLength(0)
    })
  })

  it('start at the neck as the cork pops, and are in full show at the still moment', () => {
    each((kind, strength, seed) => {
      const first = shown(kind, seed, 0.1, strength)
      expect(first.length, kind).toBeGreaterThan(0)
      for (const p of first) expect(Math.hypot(p.x, p.y), kind).toBeLessThan(0.5)
      const still = shown(kind, seed, EFFECT_STILL_AGE, strength)
      expect(Math.max(...still.map((p) => p.alpha)), kind).toBeGreaterThan(0.5)
      expect(still.length, kind).toBeGreaterThanOrEqual(
        Math.min(4, effectCount(kind, strength) / 8),
      )
    })
  })

  it('are the same for a seed and differ between seeds', () => {
    each((kind, strength, seed) => {
      const n = effectCount(kind, strength)
      for (const age of [0.3, EFFECT_STILL_AGE, 2])
        for (let i = 0; i < n; i += 7)
          expect(at(kind, seed, i, age, strength)).toEqual(at(kind, seed, i, age, strength))
    })
    for (const kind of KINDS.filter((k) => k !== 'murky')) {
      const a = shown(kind, SEEDS[0]!, 1, 2).map((p) => p.x)
      const b = shown(kind, SEEDS[1]!, 1, 2).map((p) => p.x)
      expect(a).not.toEqual(b)
    }
  })

  it('leave the neck once and move a small step a frame', () => {
    const jumps: string[] = []
    each((kind, strength, seed) => {
      let before = newParticle()
      let now = newParticle()
      for (let i = 0; i < effectCount(kind, strength); i++) {
        effectParticle(kind, seed, i, AGES[0]!, strength, before)
        for (const age of AGES.slice(1)) {
          effectParticle(kind, seed, i, age, strength, now)
          const smooth =
            (now.born || !before.born) &&
            (now.born || now.alpha === 0) &&
            (before.alpha <= 0 ||
              now.alpha <= 0 ||
              (Math.hypot(now.x - before.x, now.y - before.y) < 0.12 &&
                Math.abs(now.size - before.size) < 0.12))
          if (!smooth) jumps.push(`${kind} ${strength} #${i} at ${age.toFixed(3)}`)
          ;[before, now] = [now, before]
        }
      }
    })
    expect(jumps.slice(0, 5)).toEqual([])
  })

  it('give a murky potion one fat bubble that hangs, then pops into a few droplets', () => {
    const n = effectCount('murky', 1)
    expect(n).toBeLessThanOrEqual(9)
    const run = AGES.map((age) => ({ age, all: shown('murky', 7, age, 1) }))
    const bubbles = run.map(({ all }) => all.filter((p) => p.shape === SHAPES.blob))
    expect(Math.max(...bubbles.map((b) => b.length))).toBe(1)
    const hanging = shown('murky', 7, EFFECT_STILL_AGE, 1)
    expect(hanging).toHaveLength(1)
    expect(hanging[0]!.size).toBeGreaterThan(0.85)
    expect(hanging[0]!.y).toBeGreaterThan(0.3)
    const popped = run.find(({ all }) => all.some((p) => p.shape === SHAPES.droplet))!
    expect(popped.age).toBeGreaterThan(EFFECT_STILL_AGE + 0.3)
    const last = run.findLast(({ all }) => all.some((p) => p.shape === SHAPES.blob))!
    expect(popped.age - last.age).toBeLessThan(0.1)
  })

  it('wobble the fat bubble as it squeezes out of the neck', () => {
    const warps = AGES.filter((age) => age < 0.6).map((age) => at('murky', 7, 0, age, 1).warp)
    expect(Math.max(...warps)).toBeGreaterThan(0.08)
    expect(Math.min(...warps)).toBeLessThan(-0.08)
    for (const w of AGES.map((age) => at('murky', 7, 0, age, 1).warp))
      expect(Math.abs(w)).toBeLessThan(0.3)
  })
})

describe('the effect in the frame', () => {
  const frame: Frame = { left: -1.6, right: 1.6, top: 3.4 }
  const bottle = 3.8
  const radius = 0.13

  it('reaches as far as the bottle is big when there is room', () => {
    const reach = effectReach(0, 0, frame, bottle, { left: 0, right: 0, up: 0 })
    expect(reach.up).toBeCloseTo(REACH.up * bottle, 9)
    expect(reach.left).toBe(reach.right)
    expect(reach.right).toBeLessThanOrEqual(REACH.side * bottle)
  })

  it('reaches no further than the frame on any side, and never backwards', () => {
    for (const x of [-1.58, -1.2, 0, 1.2, 1.58, 2])
      for (const y of [1.2, 2.6, 3.3, 3.5]) {
        const reach = effectReach(x, y, frame, bottle, { left: 0, right: 0, up: 0 })
        expect(reach.left).toBeGreaterThanOrEqual(0)
        expect(reach.right).toBeGreaterThanOrEqual(0)
        expect(reach.up).toBeGreaterThanOrEqual(0)
        expect(x - reach.left).toBeGreaterThanOrEqual(Math.min(x, frame.left))
        expect(x + reach.right).toBeLessThanOrEqual(Math.max(x, frame.right))
        expect(y + reach.up).toBeLessThanOrEqual(Math.max(y, frame.top))
      }
  })

  it('keeps every sprite whole in the frame, however near an edge the neck is', () => {
    const out = { x: 0, y: 0 }
    const p = newParticle()
    for (const x of [-1.5, -0.9, 0, 0.9, 1.5])
      for (const y of [1.4, 2.4, 3.2]) {
        const reach = effectReach(x, y, frame, bottle, { left: 0, right: 0, up: 0 })
        for (const px of [-1, -0.5, 0, 0.5, 1])
          for (const py of [-EFFECT_BOX.down, 0, 0.5, 1]) {
            Object.assign(p, { x: px, y: py })
            placeParticle(p, x, y, reach, frame, radius, out)
            expect(out.x - radius).toBeGreaterThanOrEqual(frame.left)
            expect(out.x + radius).toBeLessThanOrEqual(frame.right)
            expect(out.y + radius).toBeLessThanOrEqual(frame.top)
          }
      }
  })

  it('turns to the open side when the neck is hard by an edge, and squeezes nothing against it', () => {
    const out = { x: 0, y: 0 }
    const p = newParticle()
    for (const x of [-1.45, 1.45]) {
      const reach = effectReach(x, 2, frame, bottle, { left: 0, right: 0, up: 0 })
      const open = x < 0 ? 1 : -1
      const placed = [-1, -0.5, 0.5, 1].map((px) => {
        Object.assign(p, { x: px, y: 0.5 })
        return placeParticle(p, x, 2, reach, frame, radius, out).x
      })
      for (const at of placed) expect((at - x) * open).toBeGreaterThan(0.2)
      expect(placed[0]).toBeCloseTo(placed[3]!, 9)
      expect(placed[1]).toBeCloseTo(placed[2]!, 9)
    }
    const reach = effectReach(0.5, 2, frame, bottle, { left: 0, right: 0, up: 0 })
    Object.assign(p, { x: 1, y: 0.5 })
    expect(placeParticle(p, 0.5, 2, reach, frame, radius, out).x).toBeGreaterThan(0.5)
  })

  it('rises straight up from the neck', () => {
    const out = { x: 0, y: 0 }
    const p = newParticle()
    const reach = effectReach(0.4, 1.5, frame, bottle, { left: 0, right: 0, up: 0 })
    let last = -Infinity
    for (const py of [0, 0.25, 0.5, 0.75, 1]) {
      Object.assign(p, { x: 0, y: py })
      placeParticle(p, 0.4, 1.5, reach, frame, radius, out)
      expect(out.x).toBe(0.4)
      expect(out.y).toBeGreaterThan(last)
      last = out.y
    }
    Object.assign(p, { x: 0, y: 0 })
    expect(placeParticle(p, 0.4, 1.5, reach, frame, radius, out)).toEqual({ x: 0.4, y: 1.5 })
  })
})
