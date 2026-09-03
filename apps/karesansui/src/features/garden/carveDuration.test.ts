import { describe, expect, it } from 'vitest'

import {
  carveDurationMs,
  fastestCogTurns,
  MAX_CARRIER_REV_PER_SEC,
  MIN_MS_PER_TURN,
} from './carveDuration.ts'
import { fullTurns, MAX_GEARS, ringOpts, wheelOpts } from './engine/gears.ts'
import { DEFAULT_CONFIG, type GardenConfig } from './engine/state.ts'

/** The spec's requirement (a11y-pass §4): no orbiting element beyond ~3 rev/s. */
const SPEC_MAX_REV_PER_SEC = 3

function cfg(over: Partial<GardenConfig>): GardenConfig {
  return { ...DEFAULT_CONFIG, ...over }
}

/**
 * Every non-empty train of up to MAX_GEARS cogs the console can assemble, up to
 * cog order (the duration depends on the multiset of teeth, not the order).
 */
function selectableTrains(): { ring: number; wheels: number[] }[] {
  const opts = wheelOpts()
  const grow = (wheels: number[], from: number): number[][] =>
    wheels.length >= MAX_GEARS
      ? [wheels]
      : [wheels, ...opts.slice(from).flatMap((w, i) => grow([...wheels, w], from + i))]
  return ringOpts().flatMap((ring) =>
    opts.flatMap((w, i) => grow([w], i).map((wheels) => ({ ring, wheels }))),
  )
}

describe('fastestCogTurns', () => {
  it('is the single cog turn count for a one-cog train', () => {
    expect(fastestCogTurns(120, [63])).toBe(21)
    expect(fastestCogTurns(144, [24])).toBe(1)
    expect(fastestCogTurns(120, [45])).toBe(3)
  })

  it('takes the fastest cog, not the train pattern-closure LCM', () => {
    // fullTurns(96, [63, 52]) is 200 (the closure count), but no cog turns more
    // than 21 times across the draw, so 21 is what sets the rotation rate.
    expect(fullTurns(96, [63, 52])).toBe(200)
    expect(fastestCogTurns(96, [63, 52])).toBe(21)
  })

  it('never reports less than one turn', () => {
    expect(fastestCogTurns(144, [36, 24])).toBe(1)
    // An empty train is unreachable through GardenConfig (1..4 cogs); this pins
    // the reduce's identity so a future caller cannot get a zero-turn floor.
    expect(fastestCogTurns(144, [])).toBe(1)
  })
})

describe('carveDurationMs at the brisk end', () => {
  it('leaves a 3-turn train at the reference 1500 ms', () => {
    expect(carveDurationMs(cfg({ ring: 120, wheels: [45], speed: 100 }))).toBe(1500)
  })

  it('leaves a 1-turn train at the reference 1500 ms', () => {
    expect(carveDurationMs(cfg({ ring: 144, wheels: [24], speed: 100 }))).toBe(1500)
  })

  it('floors the worst 21-turn train at 21 * MIN_MS_PER_TURN', () => {
    expect(carveDurationMs(cfg({ ring: 120, wheels: [63], speed: 100 }))).toBe(21 * MIN_MS_PER_TURN)
  })

  it('floors a multi-cog train on its fastest cog', () => {
    expect(carveDurationMs(cfg({ ring: 96, wheels: [63, 52], speed: 100 }))).toBe(
      21 * MIN_MS_PER_TURN,
    )
  })
})

describe('carveDurationMs away from the brisk end', () => {
  it('keeps the meditative end of the speed curve untouched', () => {
    // 1500 + 1^1.7 * 30000; the 21-turn floor (10500 ms) is far below it.
    expect(carveDurationMs(cfg({ ring: 120, wheels: [63], speed: 0 }))).toBeCloseTo(31500, 6)
    expect(carveDurationMs(cfg({ ring: 144, wheels: [24], speed: 0 }))).toBeCloseTo(31500, 6)
  })

  it('lets the speed curve win as soon as it exceeds the floor', () => {
    const floored = carveDurationMs(cfg({ ring: 120, wheels: [63], speed: 100 }))
    const curve = carveDurationMs(cfg({ ring: 120, wheels: [63], speed: 50 }))
    expect(curve).toBeGreaterThan(floored)
    expect(curve).toBeCloseTo(1500 + Math.pow(0.5, 1.7) * 30000, 6)
  })

  it('is monotonically non-increasing in speed', () => {
    const config = cfg({ ring: 96, wheels: [63] })
    for (let speed = 1; speed <= 100; speed++) {
      const faster = carveDurationMs({ ...config, speed })
      const slower = carveDurationMs({ ...config, speed: speed - 1 })
      expect(faster).toBeLessThanOrEqual(slower)
    }
  })

  it('clamps an out-of-range speed instead of returning NaN', () => {
    // DEFAULT_CONFIG is ring 96 / wheels [52], a 13-turn train: floor 6500 ms.
    expect(carveDurationMs(cfg({ speed: 140 }))).toBe(13 * MIN_MS_PER_TURN)
    expect(carveDurationMs(cfg({ speed: -40 }))).toBeCloseTo(31500, 6)
  })
})

// The pin that fails if someone widens ringOpts/wheelOpts or raises the speed
// ceiling: at the fastest selectable speed, nothing in the mech bowl orbits
// faster than the bound.
describe('rotation-rate pin over the selectable option space', () => {
  it('bounds every ring x wheel pair at speed 100', () => {
    for (const ring of ringOpts()) {
      for (const w of wheelOpts()) {
        const turns = fullTurns(ring, [w])
        const seconds = carveDurationMs(cfg({ ring, wheels: [w], speed: 100 })) / 1000
        const revPerSec = turns / seconds
        expect(revPerSec, `ring ${ring} / wheel ${w}`).toBeLessThanOrEqual(MAX_CARRIER_REV_PER_SEC)
        expect(revPerSec, `ring ${ring} / wheel ${w}`).toBeLessThanOrEqual(SPEC_MAX_REV_PER_SEC)
      }
    }
  })

  it('bounds every cog of every selectable train at speed 100', () => {
    for (const { ring, wheels } of selectableTrains()) {
      const seconds = carveDurationMs(cfg({ ring, wheels, speed: 100 })) / 1000
      for (const w of wheels) {
        const revPerSec = fullTurns(ring, [w]) / seconds
        expect(revPerSec, `ring ${ring} / train ${wheels.join('+')}`).toBeLessThanOrEqual(
          MAX_CARRIER_REV_PER_SEC,
        )
      }
    }
  })

  it('still finishes the worst train inside 11 s at speed 100', () => {
    for (const { ring, wheels } of selectableTrains()) {
      expect(carveDurationMs(cfg({ ring, wheels, speed: 100 }))).toBeLessThanOrEqual(11_000)
    }
  })
})
