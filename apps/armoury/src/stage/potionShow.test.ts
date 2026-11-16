import { describe, expect, it } from 'vitest'

import { MIX_REVEAL_SECONDS, MIX_REVEAL_SECONDS_REDUCED } from '../potion/mixBeats.ts'
import { EFFECT_SECONDS, EFFECT_STILL_AGE } from './effectKinds.ts'
import { REST_CAP } from './potionMaterials.ts'
import {
  EFFECT_CAP,
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

describe('the effect after the pop', () => {
  const b = SHOW_BEATS

  it('lasts from the pop to the stopper setting off back, and nothing is let out outside it', () => {
    expect(b.settle - b.pop).toBeCloseTo(EFFECT_SECONDS, 9)
    for (const options of [FIRST, REPLAY]) {
      for (const { t, show } of frames(options)) {
        if (Math.abs(t - b.pop) < 1e-6 || Math.abs(t - b.settle) < 1e-6) continue
        const inside = t > b.pop && t < b.settle
        if (!inside) {
          expect(show.emit, `emit at ${t.toFixed(3)}`).toBe(0)
          expect(show.age, `age at ${t.toFixed(3)}`).toBe(0)
          expect(show.cap, `cap at ${t.toFixed(3)}`).toBe(REST_CAP)
        } else {
          expect(show.emit).toBeGreaterThan(0)
          expect(show.emit).toBeLessThanOrEqual(1)
          expect(show.age).toBeCloseTo(t - b.pop, 9)
          expect(show.cap).toBeGreaterThan(REST_CAP)
          expect(show.cap).toBeLessThanOrEqual(EFFECT_CAP)
        }
      }
    }
    for (const { show } of frames(RATTLE)) {
      expect(show.emit).toBe(0)
      expect(show.cap).toBe(REST_CAP)
    }
  })

  it('starts in the frame of the pop, is in full flow 0.8 s later and fades before the window ends', () => {
    const at = (age: number) => potionShow(b.pop + age, REPLAY).emit
    expect(at(0)).toBe(0)
    expect(at(FRAME)).toBeGreaterThan(0.05)
    expect(at(0.1)).toBeGreaterThan(0.3)
    expect(at(0.8)).toBe(1)
    expect(at(1.6)).toBe(1)
    expect(at(EFFECT_SECONDS - 0.1)).toBeLessThan(0.6)
    const run = frames(REPLAY)
    for (let i = 1; i < run.length; i++)
      expect(Math.abs(run[i]!.show.emit - run[i - 1]!.show.emit)).toBeLessThan(0.12)
  })

  it('under reduced motion holds one still moment and fades it in 0.3 s, holds 1.2 s and fades out 0.5 s', () => {
    const from = MIX_REVEAL_SECONDS_REDUCED
    for (const options of [REDUCED_FIRST, REDUCED_REPLAY]) {
      const at = (t: number) => potionShow(from + t, options)
      expect(at(-0.01).emit).toBe(0)
      expect(at(0.15).emit).toBeCloseTo(0.5, 9)
      expect(at(0.3).emit).toBeCloseTo(1, 9)
      expect(at(1.4).emit).toBe(1)
      expect(at(1.75).emit).toBeCloseTo(0.5, 9)
      expect(at(1.99).emit).toBeLessThan(0.05)
      for (const { show } of frames(options)) {
        expect(show.age).toBe(show.emit > 0 ? EFFECT_STILL_AGE : 0)
        expect(show.cap === REST_CAP).toBe(show.emit === 0)
        if (show.emit > 0) expect(show.popped).toBe(true)
      }
    }
  })
})

describe('the stopper out of the way of the effect', () => {
  const b = SHOW_BEATS

  it('swings aside only once it is clear of the lip, and is back above the neck before it settles', () => {
    for (const { t, show } of frames(REPLAY)) {
      expect(show.stopperAside).toBeGreaterThanOrEqual(0)
      expect(show.stopperAside).toBeLessThanOrEqual(1)
      if (show.stopperAside > 0.02)
        expect(show.stopperLift, `at ${t.toFixed(3)}`).toBeGreaterThan(1)
      if (t < b.pop || t >= b.settle) expect(show.stopperAside).toBe(0)
    }
    expect(potionShow(b.pop + 0.6, REPLAY).stopperAside).toBe(1)
    expect(potionShow(b.settle - 0.5, REPLAY).stopperAside).toBe(1)
    for (const { show } of frames(RATTLE)) expect(show.stopperAside).toBe(0)
  })

  it('moves a small step a frame', () => {
    const run = frames(REPLAY)
    for (let i = 1; i < run.length; i++)
      expect(Math.abs(run[i]!.show.stopperAside - run[i - 1]!.show.stopperAside)).toBeLessThan(0.12)
  })

  it('is shown aside without travelling under reduced motion', () => {
    for (const { show } of frames(REDUCED_REPLAY))
      expect(show.stopperAside).toBe(show.popped ? 1 : 0)
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

  /** A fading effect: never brighter, and while anything shows its age goes on a frame at a time. */
  const expectRunsOn = (run: { t: number; show: PotionShow }[]) => {
    for (let i = 1; i < run.length; i++) {
      const [a, b] = [run[i - 1]!.show, run[i]!.show]
      expect(b.emit, `emit ${run[i]!.t.toFixed(3)}`).toBeLessThanOrEqual(a.emit)
      expect(a.emit - b.emit).toBeLessThan(0.2)
      if (b.emit > 0) expect(b.age - a.age, `age ${run[i]!.t.toFixed(3)}`).toBeCloseTo(FRAME, 6)
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

  it('lets nothing out when it is put back before the pop, though the stopper pops on the way', () => {
    const player = new PotionShowPlayer()
    player.play(100, FIRST)
    drawn(player, 100, 101.7, () => 0)
    player.leave(101.7)
    const after = drawn(player, 101.7, 103, () => 0)
    expect(after.some(({ show }) => show.popped)).toBe(true)
    for (const { show } of after) {
      expect(show.emit).toBe(0)
      expect(show.cap).toBe(REST_CAP)
    }
  })

  it('fades the effect where it is when put back after the pop, its age running on', () => {
    const player = new PotionShowPlayer()
    player.play(100, REPLAY)
    const before = drawn(player, 100, 103, () => 1)
    player.leave(103)
    const after = drawn(player, 103, 103.6, () => 1)
    expectRunsOn([before.at(-1)!, ...after])
    expect(after.at(-1)!.show).toEqual(showRest(1))
  })

  it('fades the old effect where it is when tapped mid-effect, then starts the new one from its pop', () => {
    const player = new PotionShowPlayer()
    player.play(100, REPLAY)
    const before = drawn(player, 100, 103, () => 1)
    expect(before.at(-1)!.show.emit).toBe(1)
    player.play(103 - FRAME, REPLAY)
    const fading = drawn(player, 103, 103.3 - FRAME, () => 1)
    expectRunsOn([before.at(-1)!, ...fading])
    const tapped = 103 - FRAME
    const quiet = drawn(player, 103.3, tapped + MIX_REVEAL_SECONDS, () => 1)
    for (const { show } of quiet) expect(show.emit).toBe(0)
    const again = player.draw(tapped + MIX_REVEAL_SECONDS + 0.2, 1)
    expect(again.age).toBeCloseTo(0.2, 9)
    expect(again.emit).toBeGreaterThan(0)
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
