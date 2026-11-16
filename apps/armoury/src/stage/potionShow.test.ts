import { describe, expect, it } from 'vitest'

import { MIX_REVEAL_SECONDS, MIX_REVEAL_SECONDS_REDUCED } from '../potion/mixBeats.ts'
import { REST_CAP } from './potionMaterials.ts'
import {
  LIFT,
  potionShow,
  type PotionShow,
  PotionShowPlayer,
  SHOW_BEATS,
  showOptions,
  showRest,
  showSeconds,
  type ShowOptions,
} from './potionShow.ts'

const FRAME = 1 / 60
const FIRST: ShowOptions = { firstMix: true, full: true, reducedMotion: false }
const REPLAY: ShowOptions = { firstMix: false, full: true, reducedMotion: false }
const RATTLE: ShowOptions = { firstMix: false, full: false, reducedMotion: false }
const REDUCED_FIRST: ShowOptions = { ...FIRST, reducedMotion: true }
const REDUCED_REPLAY: ShowOptions = { ...REPLAY, reducedMotion: true }

const frames = (options: ShowOptions, from = -0.5, to = showSeconds(options) + 0.5) =>
  Array.from({ length: Math.ceil((to - from) / FRAME) }, (_, i) => {
    const t = from + i * FRAME
    return { t, show: potionShow(t, options) }
  })

const travels = (s: PotionShow) =>
  s.lift !== 0 || s.swirl !== 0 || s.stopperTurn !== 0 || s.spin !== 0

describe('the potion show', () => {
  it('is at rest before it starts and once it is over, mixed after a first mix', () => {
    for (const options of [FIRST, REPLAY, RATTLE, REDUCED_FIRST, REDUCED_REPLAY]) {
      const end = showSeconds(options)
      const mixedAfter = options.full ? 1 : 0
      expect(potionShow(-1, options)).toEqual(showRest(options.firstMix ? 0 : mixedAfter))
      expect(potionShow(end, options)).toEqual(showRest(mixedAfter))
      expect(potionShow(end + 30, options)).toEqual(showRest(mixedAfter))
      expect(potionShow(Infinity, options)).toEqual(showRest(mixedAfter))
    }
    expect(showRest(1)).toMatchObject({ cap: REST_CAP, emit: 0, age: 0, popped: false })
  })

  it('plays its beats in order and lasts as the spec proposes', () => {
    const b = SHOW_BEATS
    const order = [b.lift, b.swirl, b.twist, b.pop, b.live, b.settle, b.sink, b.end]
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]!)
    expect(b.pop).toBe(MIX_REVEAL_SECONDS)
    expect(showSeconds(FIRST)).toBeCloseTo(5.2, 9)
    expect(showSeconds(REPLAY)).toBe(showSeconds(FIRST))
    expect(showSeconds(RATTLE)).toBeCloseTo(0.4, 9)

    const at = (t: number) => potionShow(t, FIRST)
    expect(at(0.2).lift).toBeGreaterThan(0)
    expect(at(0.4).lift).toBeCloseTo(LIFT, 9)
    expect(at(0.3).swirl).toBe(0)
    expect(at(1.0).swirl).toBe(1)
    expect(at(1.6).swirl).toBe(0)
    expect(at(1.55).stopperLift).toBe(0)
    expect(at(1.75).stopperTurn).toBeGreaterThan(0)
    expect(at(1.9).stopperTurn).toBeCloseTo(Math.PI / 2, 9)
    expect(at(3).stopperLift).toBeGreaterThan(1)
    expect(at(4.95).stopperLift).toBe(0)
    expect(at(4.95).lift).toBeGreaterThan(0)
    expect(at(4.95).lift).toBeLessThan(LIFT)
  })

  it('pops the stopper exactly at the reveal, under reduced motion too', () => {
    for (const [options, reveal] of [
      [FIRST, MIX_REVEAL_SECONDS],
      [REPLAY, MIX_REVEAL_SECONDS],
      [REDUCED_FIRST, MIX_REVEAL_SECONDS_REDUCED],
      [REDUCED_REPLAY, MIX_REVEAL_SECONDS_REDUCED],
    ] as const) {
      expect(potionShow(reveal - 1e-6, options).popped).toBe(false)
      expect(potionShow(reveal, options).popped).toBe(true)
      expect(potionShow(reveal + 0.5, options).popped).toBe(true)
    }
    expect(frames(RATTLE).some(({ show }) => show.popped)).toBe(false)
  })

  it('mixes once from 0 to 1 on a first mix, mixed by the time the stopper turns, and stays 1 on a replay', () => {
    let last = -Infinity
    for (const { t, show } of frames(FIRST, 0)) {
      expect(show.mix, `t ${t}`).toBeGreaterThanOrEqual(last)
      last = show.mix
    }
    expect(potionShow(0, FIRST).mix).toBe(0)
    expect(potionShow(SHOW_BEATS.twist, FIRST).mix).toBe(1)
    for (const { show } of frames(REPLAY)) expect(show.mix).toBe(1)
    for (const { show } of frames(RATTLE)) expect(show.mix).toBe(0)
  })

  it('moves nothing by more than a small step from one 60 Hz frame to the next', () => {
    const steps = { lift: 0.006, mix: 0.04, swirl: 0.08, stopperLift: 0.35, stopperTurn: 0.15 }
    for (const options of [FIRST, REPLAY, RATTLE]) {
      const run = frames(options)
      for (let i = 1; i < run.length; i++) {
        const [a, b] = [run[i - 1]!.show, run[i]!.show]
        for (const [key, most] of Object.entries(steps) as [keyof typeof steps, number][])
          expect(Math.abs(b[key] - a[key]), `${key} at ${run[i]!.t.toFixed(3)}`).toBeLessThan(most)
        if (a.swirl > 0 || b.swirl > 0) expect(Math.abs(b.spin - a.spin)).toBeLessThan(0.3)
      }
    }
  })

  it('swirls hardest in the middle of the swirl', () => {
    const run = frames(FIRST).filter(({ show }) => show.swirl === 1)
    const middle = (SHOW_BEATS.swirl + SHOW_BEATS.twist) / 2
    expect(run[0]!.t).toBeLessThan(middle)
    expect(run[run.length - 1]!.t).toBeGreaterThan(middle)
  })

  it('only rattles the stopper in its seat with fewer than three, for 0.4 s', () => {
    const run = frames(RATTLE)
    expect(Math.max(...run.map(({ show }) => show.stopperLift))).toBeGreaterThan(0.08)
    expect(Math.max(...run.map(({ show }) => Math.abs(show.stopperTurn)))).toBeGreaterThan(0.12)
    for (const { t, show } of run) {
      expect(show.lift).toBe(0)
      expect(show.swirl).toBe(0)
      expect(show.mix).toBe(0)
      expect(show.stopperLift).toBeGreaterThanOrEqual(0)
      expect(show.stopperLift).toBeLessThan(0.1)
      if (t < 0 || t >= 0.4) expect(show).toEqual(showRest(0))
    }
  })

  it('under reduced motion lifts and spins nothing, cross-fades the mix in 0.3 s and shows the stopper out without travel', () => {
    for (const { show } of frames(REDUCED_FIRST)) expect(travels(show)).toBe(false)
    expect(potionShow(0.15, REDUCED_FIRST).mix).toBeCloseTo(0.5, 9)
    expect(potionShow(MIX_REVEAL_SECONDS_REDUCED, REDUCED_FIRST).mix).toBe(1)
    for (const { show } of frames(REDUCED_REPLAY)) expect(show.mix).toBe(1)
    const out = frames(REDUCED_FIRST)
      .map(({ show }) => show.stopperLift)
      .filter((v) => v > 0)
    expect(new Set(out).size).toBe(1)
    expect(showSeconds(REDUCED_FIRST)).toBeCloseTo(0.3 + 0.3 + 1.2 + 0.5, 9)
    expect(potionShow(showSeconds(REDUCED_FIRST) - 0.01, REDUCED_FIRST).stopperLift).toBe(out[0])
    expect(showSeconds({ ...RATTLE, reducedMotion: true })).toBe(0)
    expect(potionShow(0.2, { ...RATTLE, reducedMotion: true })).toEqual(showRest(0))
  })

  it('starts a restart from the mix and the spin it was at', () => {
    const show = potionShow(0, { ...FIRST, mixFrom: 0.6, spinFrom: 2 })
    expect(show.mix).toBe(0.6)
    expect(potionShow(1, { ...FIRST, mixFrom: 0.6 }).mix).toBeGreaterThanOrEqual(0.6)
    expect(potionShow(SHOW_BEATS.swirl + 0.3, { ...FIRST, spinFrom: 2 }).spin).toBeGreaterThan(
      potionShow(SHOW_BEATS.swirl + 0.3, FIRST).spin,
    )
  })
})

describe('the potion show as the stage plays it', () => {
  const drawn = (
    player: PotionShowPlayer,
    from: number,
    to: number,
    restMix: (t: number) => number,
  ) =>
    Array.from({ length: Math.round((to - from) / FRAME) }, (_, i) => {
      const t = from + i * FRAME
      return { t, show: player.draw(t, restMix(t)) }
    })
  const expectSmooth = (run: { t: number; show: PotionShow }[]) => {
    for (let i = 1; i < run.length; i++) {
      const [a, b] = [run[i - 1]!.show, run[i]!.show]
      const at = run[i]!.t.toFixed(3)
      expect(Math.abs(b.mix - a.mix), `mix ${at}`).toBeLessThan(0.05)
      expect(Math.abs(b.lift - a.lift), `lift ${at}`).toBeLessThan(0.006)
      expect(Math.abs(b.stopperLift - a.stopperLift), `stopper ${at}`).toBeLessThan(0.35)
      expect(Math.abs(b.swirl - a.swirl), `swirl ${at}`).toBeLessThan(0.1)
    }
  }

  it('draws the potion at rest by its params before any show', () => {
    const player = new PotionShowPlayer()
    expect(player.draw(10, 0)).toEqual(showRest(0))
    expect(player.draw(10, 1)).toEqual(showRest(1))
  })

  it('keeps the look still when the params turn mixed at the reveal, and after the show', () => {
    const player = new PotionShowPlayer()
    player.play(100, FIRST)
    const run = drawn(player, 100, 108, (t) => (t >= 100 + MIX_REVEAL_SECONDS ? 1 : 0))
    expectSmooth(run)
    expect(run[run.length - 1]!.show).toEqual(showRest(1))
  })

  it('restarts from what it drew when tapped mid-show, never back to the layers', () => {
    const player = new PotionShowPlayer()
    player.play(100, FIRST)
    const before = drawn(player, 100, 101.2, () => 0)
    const mid = before[before.length - 1]!.show
    expect(mid.mix).toBeGreaterThan(0.2)
    expect(mid.mix).toBeLessThan(1)
    player.play(101.2, FIRST)
    const after = drawn(player, 101.2, 108, (t) => (t >= 101.2 + MIX_REVEAL_SECONDS ? 1 : 0))
    expectSmooth([...before, ...after])
    expect(Math.min(...after.map(({ show }) => show.mix))).toBeGreaterThanOrEqual(mid.mix)
  })

  it('restarts a show that is over from rest, as a fresh show', () => {
    const player = new PotionShowPlayer()
    player.play(100, REPLAY)
    player.draw(110, 1)
    player.play(110, REPLAY)
    expect(player.draw(110.2, 1)).toEqual(potionShow(110.2 - 110, REPLAY))
  })

  it('settles to rest, mixed, while it is put back during a first mix', () => {
    const player = new PotionShowPlayer()
    player.play(100, FIRST)
    const before = drawn(player, 100, 101, () => 0)
    player.leave(101)
    const after = drawn(player, 101, 102, () => 0)
    expectSmooth([...before, ...after])
    expect(after[after.length - 1]!.show).toEqual(showRest(1))
  })

  it('never unwinds the vortex as it is put back mid-swirl', () => {
    const player = new PotionShowPlayer()
    player.play(100, FIRST)
    const mid = drawn(player, 100, 101, () => 0).at(-1)!.show
    expect(mid.swirl).toBeGreaterThan(0.5)
    player.leave(101)
    for (const { show } of drawn(player, 101, 101.5, () => 0))
      if (show.swirl > 0) expect(show.spin).toBeGreaterThanOrEqual(mid.spin)
  })

  it('leaves at once under reduced motion, and leaves a rattle unmixed', () => {
    const reduced = new PotionShowPlayer()
    reduced.play(100, REDUCED_FIRST)
    reduced.leave(100.1)
    expect(reduced.draw(100.1, 0)).toEqual(showRest(1))
    const rattle = new PotionShowPlayer()
    rattle.play(100, RATTLE)
    rattle.leave(100.1)
    expect(rattle.draw(101, 0)).toEqual(showRest(0))
  })
})

describe('the show a potion plays at a flourish', () => {
  const layers = (n: number) => Array.from({ length: n }, () => ({}))

  it('swirls three unmixed layers into the mix, once', () => {
    expect(showOptions({ layers: layers(3), mixed: false }, false)).toEqual(FIRST)
    expect(showOptions({ layers: layers(3), mixed: true }, false)).toEqual(REPLAY)
  })

  it('only rattles the stopper with fewer than three in', () => {
    for (const n of [0, 1, 2])
      expect(showOptions({ layers: layers(n), mixed: false }, false)).toEqual(RATTLE)
  })

  it('carries reduced motion through', () => {
    expect(showOptions({ layers: layers(3), mixed: false }, true)).toEqual(REDUCED_FIRST)
    expect(showOptions({ layers: layers(3), mixed: true }, true)).toEqual(REDUCED_REPLAY)
  })
})
