import { beforeEach, describe, expect, it } from 'vitest'

import { createSequencerEngine } from '../engine/createSequencerEngine.ts'
import { STEPS_PER_PATTERN, type Kit, type Pattern } from '../engine/sequencerEngine.ts'
import { FakeAudioDriver } from '../engine/testing/fakeAudioDriver.ts'
import { SONG_POSITIONS } from '../persistence/saveFormat.ts'
import { createSongConductor } from './songConductor.ts'
import {
  BARS_PER_POSITION,
  STEPS_PER_BAR,
  barAt,
  clampGlobalBar,
  globalBarAtCell,
  globalBarAtFraction,
  globalBarOf,
  globalBarOfTick,
  readoutParts,
  songTimeline,
  tickOfGlobalBar,
  timelineIndexAt,
} from './songTimeline.ts'

/** 16 placements: empty everywhere except the listed positions, each holding clip 0. */
function placedAt(positions: readonly number[]): readonly (readonly number[])[] {
  return Array.from({ length: SONG_POSITIONS }, (_, position) =>
    positions.includes(position) ? [0] : [],
  )
}

const GAPPY = [1, 2, 5, 9, 10, 15]
const ALL = Array.from({ length: SONG_POSITIONS }, (_, position) => position)

describe('songTimeline', () => {
  it.each([
    { name: 'gaps', placed: GAPPY },
    { name: 'one placement', placed: [7] },
    { name: 'all 16', placed: ALL },
    { name: 'none', placed: [] },
  ])('lists the placed positions in order — $name', ({ placed }) => {
    const timeline = songTimeline(placedAt(placed))
    expect(timeline.positions).toEqual(placed)
    expect(timeline.barCount).toBe(placed.length * BARS_PER_POSITION)
  })

  it('skips empty positions, so the mapping runs over placed positions only', () => {
    const timeline = songTimeline(placedAt([1, 3]))
    // Global bar 4 is the first bar of the *second placed* position, not of position 1.
    expect(barAt(timeline, BARS_PER_POSITION)).toEqual({ position: 3, bar: 0 })
  })

  it("agrees with the ticket's worked example: placements at 1–8, global bar 5", () => {
    const timeline = songTimeline(placedAt([1, 2, 3, 4, 5, 6, 7, 8]))
    expect(timeline.barCount).toBe(32)
    expect(barAt(timeline, 5)).toEqual({ position: 2, bar: 1 })
  })

  it.each([
    { name: 'gaps', placed: GAPPY },
    { name: 'one placement', placed: [7] },
    { name: 'all 16', placed: ALL },
  ])('round-trips every global bar through (position, bar) — $name', ({ placed }) => {
    const timeline = songTimeline(placedAt(placed))
    for (let globalBar = 0; globalBar < timeline.barCount; globalBar += 1) {
      const at = barAt(timeline, globalBar)
      expect(at).not.toBeNull()
      expect(globalBarOf(timeline, at!.position, at!.bar)).toBe(globalBar)
    }
  })

  it('clamps a scrub past the end to the last bar of the last placed position', () => {
    const timeline = songTimeline(placedAt(GAPPY))
    const last = timeline.barCount - 1
    expect(clampGlobalBar(timeline, timeline.barCount)).toBe(last)
    expect(clampGlobalBar(timeline, 1000)).toBe(last)
    expect(barAt(timeline, 1000)).toEqual({ position: 15, bar: BARS_PER_POSITION - 1 })
  })

  it('clamps a scrub before the start to global bar 0', () => {
    const timeline = songTimeline(placedAt(GAPPY))
    expect(clampGlobalBar(timeline, -1)).toBe(0)
    expect(clampGlobalBar(timeline, -1000)).toBe(0)
    expect(barAt(timeline, -1000)).toEqual({ position: 1, bar: 0 })
  })

  it('is total on nonsense input rather than throwing', () => {
    const timeline = songTimeline(placedAt(GAPPY))
    expect(clampGlobalBar(timeline, Number.NaN)).toBe(0)
    expect(clampGlobalBar(timeline, Number.POSITIVE_INFINITY)).toBe(timeline.barCount - 1)
    expect(clampGlobalBar(timeline, 2.7)).toBe(2)
  })

  it('answers every query on a song with no placements at all', () => {
    const timeline = songTimeline(placedAt([]))
    expect(timeline.positions).toEqual([])
    expect(timeline.barCount).toBe(0)
    expect(clampGlobalBar(timeline, 5)).toBe(0)
    expect(barAt(timeline, 0)).toBeNull()
    expect(globalBarOf(timeline, 0, 0)).toBeNull()
    expect(globalBarAtFraction(timeline, 0.5)).toBe(0)
    expect(globalBarOfTick(timeline, 99)).toBe(0)
    expect(readoutParts(timeline, 0)).toBeNull()
  })

  it('gives the place in the timeline, not the position, for a seek to index by', () => {
    const timeline = songTimeline(placedAt([1, 3]))
    expect(timelineIndexAt(timeline, 0)).toBe(0)
    expect(timelineIndexAt(timeline, BARS_PER_POSITION)).toBe(1)
    // Clamped either way, and never a place the sequence has no slot for.
    expect(timelineIndexAt(timeline, 1000)).toBe(1)
    expect(timelineIndexAt(timeline, -1000)).toBe(0)
    expect(timelineIndexAt(songTimeline(placedAt([])), 0)).toBeNull()
  })

  it('has no global bar for a position that is not placed', () => {
    const timeline = songTimeline(placedAt([1, 3]))
    expect(globalBarOf(timeline, 2, 0)).toBeNull()
    expect(globalBarOf(timeline, 3, 0)).toBe(BARS_PER_POSITION)
  })

  it('starts a position on its first bar when no bar is asked for', () => {
    const timeline = songTimeline(placedAt(GAPPY))
    expect(globalBarOf(timeline, 9)).toBe(3 * BARS_PER_POSITION)
  })

  describe('the strip cell a pointer is over', () => {
    // The laptop strip draws all 16 slots (spec §4); only the placed ones are
    // on the timeline, so an empty slot has to resolve to something.
    const timeline = songTimeline(placedAt([1, 2, 5, 9]))

    it('reads a placed slot as that position and bar', () => {
      expect(globalBarAtCell(timeline, 1, 0)).toBe(0)
      expect(globalBarAtCell(timeline, 2, 3)).toBe(BARS_PER_POSITION + 3)
      expect(globalBarAtCell(timeline, 9, 2)).toBe(3 * BARS_PER_POSITION + 2)
    })

    it('resolves an empty slot forwards, to the start of the next placed one', () => {
      // Slots 3 and 4 are empty; the next placed position is 5, the third on
      // the timeline. Forwards, so a left-to-right drag never doubles back.
      expect(globalBarAtCell(timeline, 3, 0)).toBe(2 * BARS_PER_POSITION)
      expect(globalBarAtCell(timeline, 4, 2)).toBe(2 * BARS_PER_POSITION)
      // Slot 0 is before the first placed position, so it is the song's start.
      expect(globalBarAtCell(timeline, 0, 3)).toBe(0)
    })

    it('clamps the trailing empties to the last placed position (spec §4)', () => {
      // Nothing is placed after 9, so 10–15 have no forwards to go to.
      expect(globalBarAtCell(timeline, 10, 0)).toBe(timeline.barCount - 1)
      expect(globalBarAtCell(timeline, 15, 3)).toBe(timeline.barCount - 1)
    })

    it('crosses a gap monotonically, left to right', () => {
      const bars = [1, 2, 3, 4, 5].map((slot) => globalBarAtCell(timeline, slot, 0)!)
      expect(bars).toEqual([...bars].sort((a, b) => a - b))
    })

    it('clamps a bar outside 0…3 and a slot outside the strip', () => {
      expect(globalBarAtCell(timeline, 1, 99)).toBe(BARS_PER_POSITION - 1)
      expect(globalBarAtCell(timeline, 1, -4)).toBe(0)
      expect(globalBarAtCell(timeline, 99, 0)).toBe(timeline.barCount - 1)
      expect(globalBarAtCell(timeline, -3, 0)).toBe(0)
    })

    it('has no bar to point at when nothing is placed', () => {
      expect(globalBarAtCell(songTimeline(placedAt([])), 4, 1)).toBeNull()
    })
  })

  describe('snapping a fraction of the track to a bar', () => {
    const timeline = songTimeline(placedAt([1, 2, 5, 9]))
    const lastBar = timeline.barCount - 1

    it('lands the pointer on the bar it is over', () => {
      for (let bar = 0; bar < timeline.barCount; bar += 1) {
        const middle = (bar + 0.5) / timeline.barCount
        expect(globalBarAtFraction(timeline, middle)).toBe(bar)
      }
    })

    it('clamps the ends of the track', () => {
      expect(globalBarAtFraction(timeline, 0)).toBe(0)
      expect(globalBarAtFraction(timeline, -0.3)).toBe(0)
      expect(globalBarAtFraction(timeline, 1)).toBe(lastBar)
      expect(globalBarAtFraction(timeline, 1.4)).toBe(lastBar)
      expect(globalBarAtFraction(timeline, Number.NaN)).toBe(0)
    })
  })

  describe('global bar ↔ tick', () => {
    const timeline = songTimeline(placedAt(GAPPY))

    it('measures a bar in steps derived from the pattern length', () => {
      expect(STEPS_PER_BAR).toBe(STEPS_PER_PATTERN / BARS_PER_POSITION)
      expect(tickOfGlobalBar(0)).toBe(0)
      expect(tickOfGlobalBar(BARS_PER_POSITION)).toBe(STEPS_PER_PATTERN)
      expect(tickOfGlobalBar(BARS_PER_POSITION + 1)).toBe(STEPS_PER_PATTERN + STEPS_PER_BAR)
    })

    it('reads a tick back as the global bar it is inside', () => {
      for (let globalBar = 0; globalBar < timeline.barCount; globalBar += 1) {
        expect(globalBarOfTick(timeline, tickOfGlobalBar(globalBar))).toBe(globalBar)
        expect(globalBarOfTick(timeline, tickOfGlobalBar(globalBar) + STEPS_PER_BAR - 1)).toBe(
          globalBar,
        )
      }
    })

    it('wraps a tick past the end of the song, the way playback loops', () => {
      const songTicks = timeline.barCount * STEPS_PER_BAR
      expect(globalBarOfTick(timeline, songTicks)).toBe(0)
      expect(globalBarOfTick(timeline, songTicks + STEPS_PER_BAR)).toBe(1)
      expect(globalBarOfTick(timeline, -1)).toBe(0)
    })
  })

  it('gives the readout its parts: the ruler numeral, not the place in the timeline', () => {
    const timeline = songTimeline(placedAt([1, 2, 5, 9]))
    // Global bar 9 is the third placed position — song position 5, drawn "6".
    expect(readoutParts(timeline, 9)).toEqual({
      position: 6,
      bar: 2,
      barsPerPosition: BARS_PER_POSITION,
    })
  })
})

describe('the timeline and the conductor agree on the sequence', () => {
  const kit: Kit = {
    kitId: 'test',
    name: 'Test kit',
    instruments: [{ instrumentId: 'kick', name: 'Kick', artwork: 'kick.svg', sound: 'kick.wav' }],
  }
  const clip: Pattern = [
    { instrumentId: 'kick', steps: new Array<boolean>(STEPS_PER_PATTERN).fill(true) },
  ]

  let driver: FakeAudioDriver

  beforeEach(() => {
    driver = new FakeAudioDriver()
  })

  it('announces exactly the timeline positions, in order, over one pass', async () => {
    const placements = placedAt(GAPPY)
    const timeline = songTimeline(placements)

    const engine = await createSequencerEngine({ kit, driver })
    const secondsPerStep = 60 / engine.getTempo() / 4
    const announced: number[] = []
    createSongConductor(engine, [clip], placements, (position) => announced.push(position))
    await engine.start()

    // Up to the last slot's first step, plus one so its draw is released — one
    // pass exactly, stopping short of the wrap that would re-announce the first.
    const lastSlotStart = STEPS_PER_PATTERN * (timeline.positions.length - 1)
    for (let tick = 0; tick <= lastSlotStart + 1; tick += 1) {
      driver.advanceTo(tick * secondsPerStep)
      driver.fireStep()
    }

    expect(announced).toEqual(timeline.positions)
  })
})
