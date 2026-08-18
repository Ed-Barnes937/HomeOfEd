import { beforeEach, describe, expect, it } from 'vitest'

import { createSequencerEngine } from '../engine/createSequencerEngine.ts'
import {
  STEPS_PER_PATTERN,
  type Kit,
  type Pattern,
  type SequencerEngine,
} from '../engine/sequencerEngine.ts'
import { FakeAudioDriver } from '../engine/testing/fakeAudioDriver.ts'
import { createSongConductor } from './songConductor.ts'
import { scrubToBar, scrubToStep } from './songScrub.ts'
import { songTimeline } from './songTimeline.ts'

const kit: Kit = {
  kitId: 'test',
  name: 'Test kit',
  instruments: [
    { instrumentId: 'kick', name: 'Kick', artwork: 'kick.svg', sound: 'kick.wav' },
    { instrumentId: 'snare', name: 'Snare', artwork: 'snare.svg', sound: 'snare.wav' },
  ],
}

/** A clip with every step of one instrument on — each hit names its clip. */
function fullRow(on: string): Pattern {
  return kit.instruments.map((instrument) => ({
    instrumentId: instrument.instrumentId,
    steps: new Array<boolean>(STEPS_PER_PATTERN).fill(instrument.instrumentId === on),
  }))
}

/** 16 placements: empty everywhere except the given `{ position: clip }` entries. */
function placementsAt(entries: Record<number, number>): number[][] {
  const placements = Array.from({ length: STEPS_PER_PATTERN }, () => [] as number[])
  for (const [position, clip] of Object.entries(entries)) placements[Number(position)] = [clip]
  return placements
}

describe('scrubToBar', () => {
  let driver: FakeAudioDriver
  let engine: SequencerEngine

  // Positions 0 and 2 placed, 1 empty: two placed positions, 8 global bars.
  const placements = placementsAt({ 0: 0, 2: 1 })
  const timeline = songTimeline(placements)
  const clips = [fullRow('kick'), fullRow('snare')]

  beforeEach(async () => {
    driver = new FakeAudioDriver()
    engine = await createSequencerEngine({ kit, driver })
  })

  /** Is the clip whose `on` instrument fills every step the one loaded? */
  function loaded(instrumentId: string): boolean {
    return engine.getPattern().find((row) => row.instrumentId === instrumentId)?.steps[0] === true
  }

  it('moves a playing song through its conductor, without stopping it', async () => {
    const conductor = createSongConductor(engine, clips, placements, () => {})
    await engine.start()

    // Global bar 4 is the start of the second placed position — position 2.
    expect(scrubToBar({ engine, conductor, timeline }, 4)).toBe(4)

    expect(conductor.soundingPosition()).toBe(2)
    expect(loaded('snare')).toBe(true)
    expect(engine.songPos()).toBe(16)
    // Scrubbing is listening, not editing (spec §2): playback carries on.
    expect(engine.isPlaying()).toBe(true)
  })

  it('moves a stopped song through the engine, and never starts the transport', () => {
    // Stopped, there is no conductor at all — the scrub is silent (spec §4).
    expect(scrubToBar({ engine, conductor: null, timeline }, 5)).toBe(5)

    expect(engine.songPos()).toBe(20)
    expect(engine.isPlaying()).toBe(false)
    // Silent means silent: nothing sounded on the way.
    expect(driver.played).toHaveLength(0)
  })

  it('leaves the scrubbed position to sound on the next start', async () => {
    scrubToBar({ engine, conductor: null, timeline }, 4)

    // What `toggleSong` then does: build the conductor and send it to that bar.
    const conductor = createSongConductor(engine, clips, placements, () => {})
    scrubToBar({ engine, conductor, timeline }, 4)
    await engine.start()

    const scheduled: string[] = []
    engine.onBeat(({ hits }) => {
      for (const hit of hits) scheduled.push(hit.instrumentId)
    })
    driver.advanceTo(0)
    driver.fireStep()

    expect(scheduled).toEqual(['snare'])
  })

  it('is a no-op on a song with nothing placed, not a throw', () => {
    // ADR 0032's all-empty song plays the grid clip and has no conductor, so
    // there is no timeline and nothing to point at.
    expect(scrubToBar({ engine, conductor: null, timeline: songTimeline([]) }, 3)).toBeNull()

    expect(engine.songPos()).toBe(0)
    expect(engine.isPlaying()).toBe(false)
  })

  it('clamps a bar past the last placed position rather than throwing', () => {
    expect(scrubToBar({ engine, conductor: null, timeline }, 999)).toBe(7)
    expect(engine.songPos()).toBe(28)

    expect(scrubToBar({ engine, conductor: null, timeline }, -5)).toBe(0)
    expect(engine.songPos()).toBe(0)
  })
})

describe('scrubToStep', () => {
  let driver: FakeAudioDriver
  let engine: SequencerEngine

  // Positions 0 and 2 placed, 1 empty: two placed positions, 8 global bars.
  const placements = placementsAt({ 0: 0, 2: 1 })
  const timeline = songTimeline(placements)
  const clips = [fullRow('kick'), fullRow('snare')]

  beforeEach(async () => {
    driver = new FakeAudioDriver()
    engine = await createSequencerEngine({ kit, driver })
  })

  /** Is the clip whose `on` instrument fills every step the one loaded? */
  function loaded(instrumentId: string): boolean {
    return engine.getPattern().find((row) => row.instrumentId === instrumentId)?.steps[0] === true
  }

  it('moves within the position the playhead is already on, bar and all', () => {
    // Global bar 5 is bar 1 of the second placed position (position 2), whose
    // slot runs ticks 16–31. Step 9 is bar 2 of that clip.
    expect(scrubToStep({ engine, conductor: null, timeline }, 5, 9)).toEqual({
      globalBar: 4 + 2,
      step: 9,
    })
    expect(engine.songPos()).toBe(16 + 9)
  })

  it('reloads the position pattern through the conductor, so a backward step is safe', async () => {
    const conductor = createSongConductor(engine, clips, placements, () => {})
    await engine.start()
    // Past the slot's step 15, where the conductor has already swapped in the
    // *next* position's pattern one lookahead early.
    for (let tick = 0; tick <= STEPS_PER_PATTERN; tick += 1) {
      driver.advanceTo(tick * (60 / engine.getTempo() / 4))
      driver.fireStep()
    }
    expect(loaded('snare')).toBe(true)

    // Back to step 2 of the position now sounding — its own clip must come back.
    expect(scrubToStep({ engine, conductor, timeline }, 4, 2)).toEqual({ globalBar: 4, step: 2 })

    expect(conductor.soundingPosition()).toBe(2)
    expect(loaded('snare')).toBe(true)
    expect(engine.songPos()).toBe(16 + 2)
    // A scrub never stops playback (spec §2).
    expect(engine.isPlaying()).toBe(true)
  })

  it('clamps a step outside the pattern rather than leaving the position', () => {
    expect(scrubToStep({ engine, conductor: null, timeline }, 0, 99)).toEqual({
      globalBar: 3,
      step: STEPS_PER_PATTERN - 1,
    })
    expect(scrubToStep({ engine, conductor: null, timeline }, 0, -4)).toEqual({
      globalBar: 0,
      step: 0,
    })
  })

  it('still moves the step on a song with nothing placed — the grid clip is what plays', () => {
    // ADR 0032: no placements means no timeline and no conductor, but the grid
    // is showing a clip and its 16 steps are exactly what the rail scrubs.
    expect(scrubToStep({ engine, conductor: null, timeline: songTimeline([]) }, 0, 6)).toEqual({
      globalBar: 0,
      step: 6,
    })
    expect(engine.songPos()).toBe(6)
    expect(engine.isPlaying()).toBe(false)
    expect(driver.played).toHaveLength(0)
  })
})
