import { describe, expect, test } from 'vitest'

import {
  dragUpright,
  heldTilt,
  LEAN_MARGIN,
  LEAN_MAX,
  leanFit,
  leanShiftMm,
  rightUpright,
  TIP_MAX,
  sweptWidthMm,
  takeFromHold,
  UPRIGHT_PER_PX,
  uprightFlourishWeight,
  type Outline,
  type UprightPose,
} from './hold.ts'

const DEGREE = Math.PI / 180
const REST: UprightPose = { lean: 0, tip: 0, leanVelocity: 0, tipVelocity: 0 }

/** Lets go of `pose` and runs the righting spring at 60 Hz for `seconds`, returning every frame. */
const release = (pose: UprightPose, seconds: number, reducedMotion: boolean) => {
  const frames: UprightPose[] = []
  const p = { ...pose }
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    rightUpright(p, 1 / 60, reducedMotion)
    frames.push({ ...p })
  }
  return frames
}

describe('the angle the held item makes with level', () => {
  test('a level hold keeps the wand and sword numbers', () => {
    expect(heldTilt('level', true)).toBe(Math.PI * 0.4)
    expect(heldTilt('level', false)).toBe(Math.PI * 0.05)
  })

  test('an upright hold stands the item up in either orientation', () => {
    expect(heldTilt('upright', true)).toBe(Math.PI / 2)
    expect(heldTilt('upright', false)).toBe(Math.PI / 2)
  })
})

describe('dragging an upright item', () => {
  test('a drag across leans it and a drag along tips it, by the same rate', () => {
    const across = dragUpright(REST, 20, 0)
    expect(across.lean).toBeCloseTo(20 * UPRIGHT_PER_PX, 9)
    expect(across.tip).toBe(0)
    const along = dragUpright(REST, 0, 20)
    expect(along.tip).toBeCloseTo(20 * UPRIGHT_PER_PX, 9)
    expect(along.lean).toBe(0)
    expect(dragUpright(REST, -20, -20)).toMatchObject({
      lean: -20 * UPRIGHT_PER_PX,
      tip: -20 * UPRIGHT_PER_PX,
    })
  })

  test('a drag leaves it still, so letting go carries no spin', () => {
    const moving = { lean: 0.2, tip: 0.1, leanVelocity: 3, tipVelocity: -2 }
    expect(dragUpright(moving, 5, 5)).toMatchObject({ leanVelocity: 0, tipVelocity: 0 })
  })

  test('never leans past 60 degrees or tips past 45, however far it is dragged', () => {
    for (const sign of [1, -1]) {
      const far = dragUpright(REST, sign * 1e6, sign * 1e6)
      expect(Math.abs(far.lean)).toBeLessThanOrEqual(60 * DEGREE)
      expect(Math.abs(far.tip)).toBeLessThanOrEqual(45 * DEGREE)
      expect(Math.abs(far.lean)).toBeGreaterThan(59 * DEGREE)
      expect(Math.abs(far.tip)).toBeGreaterThan(44 * DEGREE)
    }
  })

  test('gives way softly over the last 10 degrees, not before', () => {
    const px = (degrees: number) => (degrees * DEGREE) / UPRIGHT_PER_PX
    const free = dragUpright({ ...REST, lean: 40 * DEGREE }, px(2), 0).lean - 40 * DEGREE
    expect(free).toBeCloseTo(2 * DEGREE, 9)
    const soft = dragUpright({ ...REST, lean: 52 * DEGREE }, px(4), 0).lean - 52 * DEGREE
    expect(soft).toBeGreaterThan(0)
    expect(soft).toBeLessThan(0.7 * 4 * DEGREE)
    const softTip = dragUpright({ ...REST, tip: -37 * DEGREE }, 0, -px(4)).tip + 37 * DEGREE
    expect(softTip).toBeLessThan(0)
    expect(softTip).toBeGreaterThan(-0.7 * 4 * DEGREE)
  })

  test('the soft limit is smooth: one long drag ends where many small ones do', () => {
    let small = REST
    for (let i = 0; i < 100; i++) small = dragUpright(small, 3, -2)
    const long = dragUpright(REST, 300, -200)
    expect(small.lean).toBeCloseTo(long.lean, 6)
    expect(small.tip).toBeCloseTo(long.tip, 6)
  })

  test('comes straight back from the limit when dragged the other way', () => {
    const atLimit = dragUpright(REST, 1e6, 0)
    const back = dragUpright(atLimit, -(4 * DEGREE) / UPRIGHT_PER_PX, 0)
    expect(atLimit.lean - back.lean).toBeCloseTo(4 * DEGREE, 9)
  })
})

describe('an upright item righting itself', () => {
  const leant = { lean: LEAN_MAX, tip: -TIP_MAX, leanVelocity: 0, tipVelocity: 0 }

  for (const reducedMotion of [false, true])
    test(`is back within half a degree of upright within 1.5 s${reducedMotion ? ', reduced motion' : ''}`, () => {
      const frames = release(leant, 1.5, reducedMotion)
      const last = frames.at(-1)!
      expect(Math.abs(last.lean)).toBeLessThan(0.5 * DEGREE)
      expect(Math.abs(last.tip)).toBeLessThan(0.5 * DEGREE)
    })

  test('wobbles past upright once, by at most a quarter of how far it leant', () => {
    const frames = release(leant, 3, false)
    const past = Math.max(...frames.map((p) => -p.lean))
    expect(past).toBeGreaterThan(0.05 * LEAN_MAX)
    expect(past).toBeLessThanOrEqual(0.25 * LEAN_MAX)
    const tipPast = Math.max(...frames.map((p) => p.tip))
    expect(tipPast).toBeLessThanOrEqual(0.25 * TIP_MAX)
  })

  test('takes about 0.8 s to settle', () => {
    const frames = release({ ...REST, lean: LEAN_MAX }, 3, false)
    const settled = frames.findIndex((_, i) =>
      frames.slice(i).every((p) => Math.abs(p.lean) < 0.05 * LEAN_MAX),
    )
    expect(settled / 60).toBeGreaterThan(0.5)
    expect(settled / 60).toBeLessThan(1.1)
  })

  test('under reduced motion never goes past upright', () => {
    for (const p of release(leant, 3, true)) {
      expect(p.lean).toBeGreaterThanOrEqual(0)
      expect(p.tip).toBeLessThanOrEqual(0)
    }
  })

  test('steps the same however the frames fall', () => {
    const coarse = { ...leant }
    for (let i = 0; i < 10; i++) rightUpright(coarse, 0.05, false)
    const fine = release(leant, 0.5, false).at(-1)!
    expect(coarse.lean).toBeCloseTo(fine.lean, 9)
    expect(coarse.tipVelocity).toBeCloseTo(fine.tipVelocity, 9)
  })

  test('stays upright once upright', () => {
    const pose = { ...REST }
    rightUpright(pose, 1 / 60, false)
    expect(pose).toEqual(REST)
  })
})

describe('how strongly a flourish holds the item upright', () => {
  const SECONDS = 3

  test('not at all before, after or without a flourish', () => {
    for (const t of [-1, -0.01, SECONDS, SECONDS + 0.5, Infinity, NaN])
      expect(uprightFlourishWeight(t, SECONDS, false)).toBe(0)
  })

  test('fully through the middle of it', () => {
    for (const t of [0.3, 1, SECONDS / 2, SECONDS - 0.3])
      expect(uprightFlourishWeight(t, SECONDS, false)).toBeCloseTo(1, 9)
  })

  test('eases in and out without a jump', () => {
    const step = 1 / 240
    let last = uprightFlourishWeight(-step, SECONDS, false)
    for (let t = 0; t <= SECONDS + step; t += step) {
      const w = uprightFlourishWeight(t, SECONDS, false)
      expect(w).toBeGreaterThanOrEqual(0)
      expect(w).toBeLessThanOrEqual(1)
      expect(Math.abs(w - last)).toBeLessThan(0.025)
      last = w
    }
    expect(uprightFlourishWeight(0.15, SECONDS, false)).toBeGreaterThan(0)
    expect(uprightFlourishWeight(0.15, SECONDS, false)).toBeLessThan(1)
  })

  test('under reduced motion, fully for the whole of it and not at all outside it, with no ease', () => {
    for (const t of [0, 0.01, 0.15, SECONDS / 2, SECONDS - 0.15, SECONDS - 0.01])
      expect(uprightFlourishWeight(t, SECONDS, true)).toBe(1)
    for (const t of [-1, -0.01, SECONDS, SECONDS + 0.01, Infinity, NaN])
      expect(uprightFlourishWeight(t, SECONDS, true)).toBe(0)
  })

  test('not at all while a drag holds the item, at any moment of it, with or without reduced motion', () => {
    for (const reducedMotion of [false, true])
      for (const t of [0, 0.15, 1, SECONDS / 2, SECONDS - 0.15])
        expect(uprightFlourishWeight(t, SECONDS, reducedMotion, Infinity)).toBe(0)
  })

  test('let go mid-flourish, it comes back over 0.3 s without a jump, then holds fully', () => {
    const back = 1
    expect(uprightFlourishWeight(back, SECONDS, false, back)).toBe(0)
    const step = 1 / 240
    let last = 0
    for (let t = back; t <= back + 0.4; t += step) {
      const w = uprightFlourishWeight(t, SECONDS, false, back)
      expect(Math.abs(w - last)).toBeLessThan(0.025)
      last = w
    }
    expect(uprightFlourishWeight(back + 0.15, SECONDS, false, back)).toBeGreaterThan(0)
    expect(uprightFlourishWeight(back + 0.15, SECONDS, false, back)).toBeLessThan(1)
    expect(uprightFlourishWeight(back + 0.3, SECONDS, false, back)).toBeCloseTo(1, 9)
  })

  test('let go under reduced motion, it holds again at once', () => {
    expect(uprightFlourishWeight(0.99, SECONDS, true, 1)).toBe(0)
    expect(uprightFlourishWeight(1, SECONDS, true, 1)).toBe(1)
  })

  test('never let go of, as before', () => {
    for (const t of [0, 0.1, 1, SECONDS - 0.1])
      expect(uprightFlourishWeight(t, SECONDS, false, 0)).toBe(
        uprightFlourishWeight(t, SECONDS, false),
      )
  })
})

describe('a drag taking an item from its flourish', () => {
  test('starts from the pose as drawn, so nothing jumps', () => {
    const pose = { lean: 0.5, tip: -0.2, leanVelocity: 2, tipVelocity: 1 }
    const taken = takeFromHold(pose, 0.75)
    expect(taken.lean).toBeCloseTo(0.125, 9)
    expect(taken.tip).toBeCloseTo(-0.05, 9)
    expect(taken.leanVelocity).toBe(0)
    expect(taken.tipVelocity).toBe(0)
    expect(takeFromHold(pose, 1)).toMatchObject({ lean: 0, tip: -0 })
    expect(takeFromHold(pose, 0)).toMatchObject({ lean: 0.5, tip: -0.2 })
  })
})

describe('an upright item leaned on a portrait screen', () => {
  // A wide body under a slim neck, as a round flask stands: the wide part sits below the middle.
  const flask: Outline = [
    [10, 0],
    [45, 40],
    [10, 90],
    [8, 130],
    [-8, 130],
    [-10, 90],
    [-45, 40],
    [-10, 0],
  ]
  const pivot = 65

  /** Where the leaned outline reaches across, mm from the axis, once shifted by `leanShiftMm`. */
  const shifted = (lean: number) => {
    const c = Math.cos(lean)
    const s = Math.sin(lean)
    const shift = leanShiftMm(flask, pivot, lean)
    const across = flask.map(([x, y]) => x * c + (y - pivot) * s + shift)
    return { min: Math.min(...across), max: Math.max(...across) }
  }

  test('the swept width is the widest it spans at any lean up to the limit, either way', () => {
    const swept = sweptWidthMm(flask, pivot)
    for (let deg = -60; deg <= 60; deg += 5) {
      const { min, max } = shifted(deg * DEGREE)
      expect(max - min).toBeLessThanOrEqual(swept + 1e-9)
    }
    const atLimit = shifted(LEAN_MAX)
    expect(atLimit.max - atLimit.min).toBeCloseTo(swept, 1)
    expect(swept).toBeGreaterThan(90)
  })

  test('shifted, it stays centred where its axis stood at every lean, and is not moved upright', () => {
    expect(leanShiftMm(flask, pivot, 0)).toBe(0)
    for (const deg of [-60, -35, -10, 10, 35, 60]) {
      const { min, max } = shifted(deg * DEGREE)
      expect((min + max) / 2).toBeCloseTo(0, 9)
    }
    // Leaned right, the wide body swings left of the pivot, so it is moved right.
    expect(leanShiftMm(flask, pivot, 35 * DEGREE)).toBeGreaterThan(0)
    expect(leanShiftMm(flask, pivot, -35 * DEGREE)).toBeCloseTo(
      -leanShiftMm(flask, pivot, 35 * DEGREE),
      9,
    )
  })

  test('fitted, it leaves the margin each side of the screen at the limit', () => {
    const swept = sweptWidthMm(flask, pivot)
    for (const width of [360, 390, 430]) {
      const k = leanFit(swept, width)
      expect(swept * k).toBeCloseTo(width * (1 - 2 * LEAN_MARGIN), 9)
    }
  })
})
