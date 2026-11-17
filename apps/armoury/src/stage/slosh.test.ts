import * as THREE from 'three'
import { describe, expect, test } from 'vitest'

import { rightUpright } from './hold.ts'
import {
  restingSlosh,
  sloshNormal,
  SPIN_MAX,
  spinBetween,
  stepSlosh,
  WOBBLE_MAX,
  wobbleOf,
  type Slosh,
} from './slosh.ts'

const DEGREE = Math.PI / 180
const FRAME = 1 / 60
const UP = new THREE.Vector3(0, 1, 0)
const still = { x: 0, y: 0, z: 0 }

const tiltOf = (s: Slosh) => sloshNormal(s, new THREE.Vector3()).angleTo(UP) / DEGREE

/** Runs the slosh at `dt` for `seconds` with the bottle turning at `spinAt(t)`, returning each frame's tilt in degrees and the surface normal. */
function run(
  spinAt: (t: number) => { x: number; y: number; z: number },
  seconds: number,
  dt = FRAME,
  s = restingSlosh(),
  reducedMotion = false,
) {
  const frames: { t: number; tilt: number; normal: THREE.Vector3 }[] = []
  for (let i = 1; i <= Math.round(seconds / dt); i++) {
    stepSlosh(s, spinAt(i * dt), dt, reducedMotion)
    frames.push({ t: i * dt, tilt: tiltOf(s), normal: sloshNormal(s, new THREE.Vector3()) })
  }
  return frames
}

/** A quick flick of the top to the right: about 50 degrees in a fifth of a second. */
const flick = (t: number) => ({ x: 0, y: 0, z: t <= 0.2 ? -4.4 : 0 })

/** A seeded drag shaking the bottle as hard as a finger can, a new turn every few frames. */
function randomDrag(seed: number) {
  let n = seed
  const next = () => ((n = (n * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1
  let spin = { x: 0, y: 0, z: 0 }
  return (t: number) => {
    if (Math.round(t / FRAME) % 4 === 0)
      spin = { x: next() * SPIN_MAX, y: next() * 3, z: next() * SPIN_MAX }
    return t < 20 ? spin : still
  }
}

describe('the liquid sloshing in the held bottle', () => {
  test('at rest the surface is level', () => {
    const s = restingSlosh()
    expect(sloshNormal(s, new THREE.Vector3()).toArray()).toEqual([0, 1, 0])
    stepSlosh(s, still, FRAME, false)
    expect(s).toEqual(restingSlosh())
  })

  test('a flick tips the surface visibly, within 12 degrees', () => {
    const peak = Math.max(...run(flick, 3).map((f) => f.tilt))
    expect(peak).toBeGreaterThan(4)
    expect(peak).toBeLessThanOrEqual(WOBBLE_MAX / DEGREE)
  })

  test('the surface leans against the turn: the top going right swings the liquid left', () => {
    const during = run(flick, 0.15).at(-1)!
    expect(during.normal.x).toBeLessThan(0)
    expect(Math.abs(during.normal.z)).toBeLessThan(1e-12)
    const tipping = run(() => ({ x: 4, y: 0, z: 0 }), 0.15).at(-1)!
    expect(tipping.normal.z).toBeLessThan(0)
  })

  test('settles to within half a degree of level within 2.5 s of the flick ending', () => {
    const after = run(flick, 3).filter((f) => f.t >= 0.2 + 2.5)
    for (const f of after) expect(f.tilt).toBeLessThan(0.5)
  })

  test('swings back past level once or twice, not more, as liquid and not jelly', () => {
    const z = run(flick, 3).map((f) => -Math.sign(f.normal.x) * f.tilt)
    let crossings = 0
    let last = 0
    for (const tilt of z) {
      if (Math.abs(tilt) < 0.5) continue
      if (last !== 0 && Math.sign(tilt) !== last) crossings++
      last = Math.sign(tilt)
    }
    expect(crossings).toBeGreaterThanOrEqual(1)
    expect(crossings).toBeLessThanOrEqual(3)
  })

  test('a bottle let go from a full lean sloshes and settles as it rights itself', () => {
    const pose = { lean: 55 * DEGREE, tip: 30 * DEGREE, leanVelocity: 0, tipVelocity: 0 }
    const s = restingSlosh()
    const tilts: number[] = []
    for (let i = 0; i < 3 * 60; i++) {
      const before = { lean: pose.lean, tip: pose.tip }
      rightUpright(pose, FRAME, false)
      stepSlosh(
        s,
        { x: (pose.tip - before.tip) / FRAME, y: 0, z: -(pose.lean - before.lean) / FRAME },
        FRAME,
        false,
      )
      tilts.push(tiltOf(s))
    }
    expect(Math.max(...tilts)).toBeGreaterThan(4)
    expect(Math.max(...tilts)).toBeLessThanOrEqual(WOBBLE_MAX / DEGREE)
    expect(Math.max(...tilts.slice(2 * 60))).toBeLessThan(0.5)
  })

  test('never moves more than 3 degrees in a frame, shaken hard for 20 s', () => {
    for (const seed of [1, 2, 3]) {
      const frames = run(randomDrag(seed), 25)
      for (let i = 1; i < frames.length; i++) {
        expect(frames[i]!.normal.angleTo(frames[i - 1]!.normal) / DEGREE).toBeLessThan(3)
        expect(frames[i]!.tilt).toBeLessThanOrEqual(WOBBLE_MAX / DEGREE + 1e-9)
      }
      expect(frames.at(-1)!.tilt).toBeLessThan(0.5)
    }
  })

  test('slosh the same however the frames fall', () => {
    const at60 = run(flick, 1.2, 1 / 60).filter((_, i) => i % 2 === 1)
    const at30 = run(flick, 1.2, 1 / 30)
    for (let i = 0; i < at30.length; i++)
      expect(Math.abs(at60[i]!.tilt - at30[i]!.tilt)).toBeLessThan(0.6)
  })

  test('under reduced motion the surface is exactly level and still, whatever the bottle does', () => {
    const s: Slosh = { x: 0.1, z: -0.05, vx: 1, vz: 2 }
    for (const f of run(randomDrag(7), 2, FRAME, s, true))
      expect(f.normal.toArray()).toEqual([0, 1, 0])
    expect(s).toEqual(restingSlosh())
  })

  test('the tilt never reaches the cap, however hard it swings', () => {
    expect(wobbleOf({ x: 0.4, z: 0.3, vx: 0, vz: 0 })).toBeLessThan(WOBBLE_MAX)
    expect(wobbleOf({ x: 0.01, z: 0, vx: 0, vz: 0 })).toBeCloseTo(0.01, 4)
  })
})

describe("the bottle's turn as a rate", () => {
  const Z = new THREE.Vector3(0, 0, 1)
  const X = new THREE.Vector3(1, 0, 0)

  test('a turn about one axis over a frame comes out as that rate about that axis', () => {
    const from = new THREE.Quaternion().setFromAxisAngle(X, 0.3)
    const to = from.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(Z, -0.05))
    const spin = spinBetween(from, to, FRAME, new THREE.Vector3())
    expect(spin.z).toBeCloseTo(-0.05 / FRAME, 6)
    expect(spin.x).toBeCloseTo(0, 6)
    expect(spin.y).toBeCloseTo(0, 6)
  })

  test('takes the short way round and reads a still bottle as still', () => {
    const q = new THREE.Quaternion().setFromAxisAngle(Z, 0.4)
    const flipped = new THREE.Quaternion(-q.x, -q.y, -q.z, -q.w)
    expect(spinBetween(q, flipped, FRAME, new THREE.Vector3()).length()).toBeCloseTo(0, 6)
    expect(spinBetween(q, q, FRAME, new THREE.Vector3()).length()).toBe(0)
  })
})
