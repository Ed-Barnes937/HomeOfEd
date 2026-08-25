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

/** 16 placements: empty everywhere except the given `{ position: clips }` entries. */
function placementsAt(entries: Record<number, number | readonly number[]>): number[][] {
  const placements = Array.from({ length: STEPS_PER_PATTERN }, () => [] as number[])
  for (const [position, clips] of Object.entries(entries)) {
    placements[Number(position)] = typeof clips === 'number' ? [clips] : [...clips]
  }
  return placements
}

describe('createSongConductor', () => {
  let driver: FakeAudioDriver
  let engine: SequencerEngine
  let secondsPerStep: number

  beforeEach(async () => {
    driver = new FakeAudioDriver()
    engine = await createSequencerEngine({ kit, driver })
    secondsPerStep = 60 / engine.getTempo() / 4
  })

  /**
   * Schedule `count` steps, each exactly one step of clock apart, releasing
   * due draws as the clock advances — the same crank the engine's own tests
   * and the ticket-03 prototype used.
   */
  function crank(count: number, from = 0): void {
    for (let i = from; i < from + count; i += 1) {
      driver.advanceTo(i * secondsPerStep)
      driver.fireStep()
    }
  }

  it('throws on a song with no placements — the caller decides what an empty song does', async () => {
    await engine.start()
    expect(() =>
      createSongConductor(engine, [fullRow('kick')], placementsAt({}), () => {}),
    ).toThrow(/placements/)
  })

  it('plays the placements left to right, skipping empty positions, and loops', async () => {
    const clips = [fullRow('kick'), fullRow('snare')]
    // Positions 0 and 2 placed, 1 empty — the sequence is kick, snare, repeat.
    createSongConductor(engine, clips, placementsAt({ 0: 0, 2: 1 }), () => {})
    await engine.start()

    const scheduled: { tick: number; instrumentId: string }[] = []
    engine.onBeat(({ tick, hits }) => {
      for (const hit of hits) scheduled.push({ tick, instrumentId: hit.instrumentId })
    })

    // Two full passes of the two-slot sequence, plus one step into the third.
    const total = STEPS_PER_PATTERN * 4 + 1
    crank(total)

    expect(scheduled).toHaveLength(total)
    const expected = ['kick', 'snare', 'kick', 'snare', 'kick']
    for (const { tick, instrumentId } of scheduled) {
      expect(instrumentId).toBe(expected[Math.floor(tick / STEPS_PER_PATTERN)])
    }
  })

  it('sounds a layered position: every clip in the column plays together', async () => {
    const clips = [fullRow('kick'), fullRow('snare')]
    // Position 0 holds both clips; position 1 holds only the kick.
    createSongConductor(engine, clips, placementsAt({ 0: [0, 1], 1: [0] }), () => {})
    await engine.start()

    const perTick = new Map<number, string[]>()
    engine.onBeat(({ tick, hits }) => {
      perTick.set(
        tick,
        hits.map((hit) => hit.instrumentId),
      )
    })

    crank(STEPS_PER_PATTERN * 2)

    // The layered slot sounds both instruments on every one of its 16 steps.
    for (let tick = 0; tick < STEPS_PER_PATTERN; tick += 1) {
      expect(perTick.get(tick)).toEqual(['kick', 'snare'])
    }
    // The single-clip slot after it is untouched by the layering.
    for (let tick = STEPS_PER_PATTERN; tick < STEPS_PER_PATTERN * 2; tick += 1) {
      expect(perTick.get(tick)).toEqual(['kick'])
    }
  })

  it('swaps gaplessly: no dropped hit, every gap exactly one step, across wraps', async () => {
    const clips = [fullRow('kick'), fullRow('snare')]
    createSongConductor(engine, clips, placementsAt({ 0: 0, 1: 1, 2: 0 }), () => {})
    await engine.start()

    const audioTimes: number[] = []
    engine.onBeat(({ audioTime, hits }) => {
      for (let i = 0; i < hits.length; i += 1) audioTimes.push(audioTime)
    })

    const total = STEPS_PER_PATTERN * 3 + 2
    crank(total)

    expect(audioTimes).toHaveLength(total)
    for (let i = 1; i < audioTimes.length; i += 1) {
      expect(audioTimes[i]! - audioTimes[i - 1]!).toBeCloseTo(secondsPerStep, 9)
    }
  })

  it('advances the sounding position on the draw channel, not at the schedule-time swap', async () => {
    const clips = [fullRow('kick'), fullRow('snare')]
    const sounded: number[] = []
    const conductor = createSongConductor(
      engine,
      clips,
      placementsAt({ 0: 0, 2: 1 }),
      (position) => sounded.push(position),
    )
    await engine.start()

    // The first draw announces position 0.
    crank(2)
    expect(sounded).toEqual([0])
    expect(conductor.soundingPosition()).toBe(0)

    // Schedule up to and including step 15: the engine's pattern swaps to the
    // next clip (schedule runs ahead) but the *sounding* position must not.
    crank(14, 2)
    expect(engine.getPattern().find((row) => row.instrumentId === 'snare')?.steps[0]).toBe(true)
    expect(conductor.soundingPosition()).toBe(0)

    // The wrap's own draw (step 15) still belongs to position 0.
    driver.advanceTo(15 * secondsPerStep + 0.1)
    expect(conductor.soundingPosition()).toBe(0)

    // Only step 0's draw — the moment the next clip is audible — advances it.
    crank(1, 16)
    driver.advanceTo(16 * secondsPerStep + 0.1)
    expect(conductor.soundingPosition()).toBe(2)
    expect(sounded).toEqual([0, 2])
  })

  it('loops a single placement on itself, announcing its position once', async () => {
    const conductor = createSongConductor(
      engine,
      [fullRow('kick')],
      placementsAt({ 5: 0 }),
      () => {},
    )
    await engine.start()

    const scheduled: string[] = []
    engine.onBeat(({ hits }) => {
      for (const hit of hits) scheduled.push(hit.instrumentId)
    })

    crank(STEPS_PER_PATTERN * 2 + 2)
    expect(scheduled.every((instrumentId) => instrumentId === 'kick')).toBe(true)
    expect(conductor.soundingPosition()).toBe(5)
  })

  describe('seek', () => {
    /** Is the clip whose `on` instrument fills every step the one loaded? */
    function loaded(instrumentId: string): boolean {
      return engine.getPattern().find((row) => row.instrumentId === instrumentId)?.steps[0] === true
    }

    it('loads the target position and reports it at once, without waiting for a draw', async () => {
      const clips = [fullRow('kick'), fullRow('snare')]
      const conductor = createSongConductor(engine, clips, placementsAt({ 0: 0, 2: 1 }), () => {})
      await engine.start()
      crank(2)

      // Global bar 4 is the start of the second placed position — position 2.
      conductor.seek(4)

      expect(conductor.soundingPosition()).toBe(2)
      expect(loaded('snare')).toBe(true)
      expect(engine.songPos()).toBe(16)
      // Scrubbing is listening, not editing: it never stops the song (spec §2).
      expect(engine.isPlaying()).toBe(true)
    })

    it('sounds the new clip on the very first step after the jump', async () => {
      const clips = [fullRow('kick'), fullRow('snare')]
      const conductor = createSongConductor(engine, clips, placementsAt({ 0: 0, 2: 1 }), () => {})
      await engine.start()
      crank(2)

      const scheduled: string[] = []
      engine.onBeat(({ hits }) => {
        for (const hit of hits) scheduled.push(hit.instrumentId)
      })

      conductor.seek(4)
      crank(1, 2)

      expect(scheduled).toEqual(['snare'])
    })

    it('announces on the next draw even when the position is unchanged', async () => {
      const clips = [fullRow('kick'), fullRow('snare')]
      const sounded: number[] = []
      const conductor = createSongConductor(
        engine,
        clips,
        placementsAt({ 0: 0, 2: 1 }),
        (position) => sounded.push(position),
      )
      await engine.start()
      crank(2)
      expect(sounded).toEqual([0])

      // Bar 1 of the same position: a jump the readout must still report.
      conductor.seek(1)
      crank(1, 2)
      driver.advanceTo(3 * secondsPerStep)

      expect(sounded).toEqual([0, 0])
    })

    it('keeps the step-15 swap in step: playback carries on into the next position', async () => {
      const clips = [fullRow('kick'), fullRow('snare')]
      const conductor = createSongConductor(engine, clips, placementsAt({ 0: 0, 2: 1 }), () => {})
      await engine.start()
      crank(2)

      const scheduled: string[] = []
      engine.onBeat(({ hits }) => {
        for (const hit of hits) scheduled.push(hit.instrumentId)
      })

      // Global bar 3: the last bar of position 0, so ticks 12–15 then the wrap.
      conductor.seek(3)
      crank(8, 2)

      // Four steps of the old clip, then the swap at step 15 lands the new one.
      expect(scheduled).toEqual([
        'kick',
        'kick',
        'kick',
        'kick',
        'snare',
        'snare',
        'snare',
        'snare',
      ])
      // The draw of the wrap's step 0 is what makes it audible to the UI.
      driver.advanceTo(10 * secondsPerStep)
      expect(conductor.soundingPosition()).toBe(2)
    })

    it('seeks into a layered position exactly as arriving there by playback does', async () => {
      const clips = [fullRow('kick'), fullRow('snare')]
      const conductor = createSongConductor(
        engine,
        clips,
        placementsAt({ 0: [0, 1], 1: 0 }),
        () => {},
      )
      await engine.start()
      // What arriving at the layered position by playback looks like: the
      // conductor loads position 0 on construction, and the song starts there.
      const byPlayback = engine.getPattern()
      expect(loaded('kick')).toBe(true)
      expect(loaded('snare')).toBe(true)

      // Play on into the single-clip position, then jump back to the layered one.
      crank(STEPS_PER_PATTERN + 1)
      driver.advanceTo((STEPS_PER_PATTERN + 1) * secondsPerStep)
      expect(conductor.soundingPosition()).toBe(1)
      expect(loaded('snare')).toBe(false)

      conductor.seek(2)

      // Not "almost the same": the same merged pattern and the same position.
      expect(engine.getPattern()).toEqual(byPlayback)
      expect(conductor.soundingPosition()).toBe(0)
    })

    it('wraps to the first position when the seek lands in the last', async () => {
      const clips = [fullRow('kick'), fullRow('snare')]
      const conductor = createSongConductor(engine, clips, placementsAt({ 0: 0, 2: 1 }), () => {})
      await engine.start()
      crank(2)

      // Global bar 7 is the last bar of the song: ticks 28–31, then the wrap.
      conductor.seek(7)
      expect(loaded('snare')).toBe(true)

      crank(4, 2)

      expect(loaded('kick')).toBe(true)
      expect(conductor.soundingPosition()).toBe(2)
    })

    it('clamps an out-of-range bar through the timeline rather than throwing', async () => {
      const clips = [fullRow('kick'), fullRow('snare')]
      const conductor = createSongConductor(engine, clips, placementsAt({ 0: 0, 2: 1 }), () => {})
      await engine.start()
      crank(2)

      conductor.seek(999)
      expect(conductor.soundingPosition()).toBe(2)
      expect(engine.songPos()).toBe(28)

      conductor.seek(-5)
      expect(conductor.soundingPosition()).toBe(0)
      expect(engine.songPos()).toBe(0)
    })

    it('seeks while stopped, leaving the target to sound on the next start', async () => {
      const clips = [fullRow('kick'), fullRow('snare')]
      const conductor = createSongConductor(engine, clips, placementsAt({ 0: 0, 2: 1 }), () => {})

      conductor.seek(4)

      expect(conductor.soundingPosition()).toBe(2)
      expect(loaded('snare')).toBe(true)

      await engine.start()
      const scheduled: string[] = []
      engine.onBeat(({ hits }) => {
        for (const hit of hits) scheduled.push(hit.instrumentId)
      })
      crank(1)
      expect(scheduled).toEqual(['snare'])
    })
  })

  it('stops conducting on dispose: the pattern never swaps again', async () => {
    const clips = [fullRow('kick'), fullRow('snare')]
    const conductor = createSongConductor(engine, clips, placementsAt({ 0: 0, 1: 1 }), () => {})
    await engine.start()

    crank(4)
    conductor.dispose()
    crank(STEPS_PER_PATTERN, 4)

    // The wrap has passed, but the disposed conductor never swapped to snare.
    expect(engine.getPattern().find((row) => row.instrumentId === 'kick')?.steps[0]).toBe(true)
    expect(engine.getPattern().find((row) => row.instrumentId === 'snare')?.steps[0]).toBe(false)
  })
})
