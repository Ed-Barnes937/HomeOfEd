import { describe, expect, it } from 'vitest'

import {
  PHONE_GROUP_STRIDE,
  PHONE_STRIP_WIDTH,
  PHONE_WINDOW_WIDTH,
  phoneBracketLeftPercent,
  phoneOffscreenSide,
  phoneSnapOffsets,
  phoneStepX,
  phoneVisibleSteps,
} from './phoneWindow.ts'

describe('phone strip geometry', () => {
  it('matches the design handoff numbers', () => {
    // "strip width 16x32 + 12x5 + 3x11 = 605px" / "snap offsets 0, then +154".
    expect(PHONE_STRIP_WIDTH).toBe(605)
    expect(PHONE_GROUP_STRIDE).toBe(154)
    expect(PHONE_WINDOW_WIDTH).toBe(246)
  })

  it('places each step at its column offset inside the strip', () => {
    expect(phoneStepX(0)).toBe(0)
    expect(phoneStepX(1)).toBe(37) // cell 32 + gap 5
    expect(phoneStepX(4)).toBe(154) // second group starts one stride in
    expect(phoneStepX(8)).toBe(308) // the handoff's "frame B offset"
    expect(phoneStepX(15)).toBe(3 * 154 + 3 * 37)
  })
})

describe('phoneSnapOffsets', () => {
  it('gives one offset per 4-step group, clamped to the reachable scroll range', () => {
    // The last group can never sit at the window's left edge — 605 - 246 = 359.
    expect(phoneSnapOffsets(PHONE_WINDOW_WIDTH)).toEqual([0, 154, 308, 359])
  })

  it('collapses offsets that clamp onto each other on a wide window', () => {
    // A 500px-wide window can only scroll 105px, so groups 1-3 all clamp there.
    expect(phoneSnapOffsets(500)).toEqual([0, 105])
  })

  it('is a single offset when the whole strip fits', () => {
    expect(phoneSnapOffsets(700)).toEqual([0])
  })

  it('keeps the last step reachable — no snap position shows all four bars', () => {
    // The clamp is why step 16 can be reached at all: it is not visible from
    // any bar line, and the grid may never hide a step.
    const last = phoneSnapOffsets(PHONE_WINDOW_WIDTH).at(-1)!
    expect(phoneVisibleSteps(last, PHONE_WINDOW_WIDTH).last).toBe(15)
    expect(phoneVisibleSteps(308, PHONE_WINDOW_WIDTH).last).toBe(14)
  })
})

describe('phoneBracketLeftPercent', () => {
  it('puts the 50%-wide bracket at the left for bars 1-2 and mid for bars 3-4', () => {
    // The handoff states left:0 viewing bars 1-2 and left:50% for bars 3-4.
    // Frame B's raw 308 / 605 is 50.9%, and the clamp that keeps the fixed
    // 50%-wide bracket on the map lands it on exactly the handoff's 50%.
    expect(phoneBracketLeftPercent(0)).toBe(0)
    expect(phoneBracketLeftPercent(308)).toBe(50)
    expect(phoneBracketLeftPercent(154)).toBeCloseTo(25.5, 1)
  })

  it('never lets the bracket run past the right end of the map', () => {
    expect(phoneBracketLeftPercent(359)).toBe(50)
    expect(phoneBracketLeftPercent(9_999)).toBe(50)
    expect(phoneBracketLeftPercent(-40)).toBe(0)
  })
})

describe('phoneVisibleSteps', () => {
  it('counts a part-cut cell as visible — it is the scroll affordance', () => {
    // 246px window from 0 covers steps 0-5 whole and part-cuts step 6.
    expect(phoneVisibleSteps(0, PHONE_WINDOW_WIDTH)).toEqual({ first: 0, last: 6 })
  })

  it('tracks the window as it scrolls', () => {
    expect(phoneVisibleSteps(308, PHONE_WINDOW_WIDTH)).toEqual({ first: 8, last: 14 })
    expect(phoneVisibleSteps(359, PHONE_WINDOW_WIDTH)).toEqual({ first: 9, last: 15 })
  })
})

describe('phoneOffscreenSide', () => {
  it('is null while the playhead is in the window, or stopped', () => {
    expect(phoneOffscreenSide(3, 0, PHONE_WINDOW_WIDTH)).toBeNull()
    expect(phoneOffscreenSide(null, 308, PHONE_WINDOW_WIDTH)).toBeNull()
  })

  it('marks the side the playhead is on once it scrolls out of view', () => {
    // Swiped to bars 3-4 with the playhead back on step 1: it is behind you.
    expect(phoneOffscreenSide(1, 308, PHONE_WINDOW_WIDTH)).toBe('left')
    // Still on bars 1-2 with the playhead already round to step 15.
    expect(phoneOffscreenSide(15, 0, PHONE_WINDOW_WIDTH)).toBe('right')
  })
})
