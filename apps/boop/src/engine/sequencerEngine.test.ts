import { beforeEach, describe, expect, it } from 'vitest'

import { createSequencerEngine } from './createSequencerEngine.ts'
import { ANCHOR_PITCH_MASK, pitchMask } from './pitch.ts'
import {
  ANCHOR_PITCH_INDEX,
  blankPattern,
  DEFAULT_BPM,
  DEFAULT_CLIP_ROWS,
  STEPS_PER_PATTERN,
  type BeatEvent,
  type Kit,
  type KitInstrument,
  type PatternRow,
  type SequencerEngine,
  type TransportEvent,
} from './sequencerEngine.ts'
import { FakeAudioDriver } from './testing/fakeAudioDriver.ts'

const kit: Kit = {
  kitId: 'test',
  name: 'Test kit',
  instruments: [
    { instrumentId: 'kick', name: 'Kick', artwork: 'kick.svg', sound: 'kick.wav', role: 'kick' },
    { instrumentId: 'snare', name: 'Snare', artwork: 'snare.svg', sound: 'snare.wav' },
    // The suite's pitched voice. Only the manifest can make an instrument
    // transposable (ADR 0067), so a lane test needs a kit that says so - and
    // `kick` beside it is what the one-note cases are asked against.
    {
      instrumentId: 'boop',
      name: 'Boop',
      artwork: 'boop.svg',
      sound: 'boop.wav',
      pitched: { rootNote: 'G4', rootMidi: 67 },
    },
  ],
}

/** A roster bigger than a clip's default row count, so the two can differ. */
const bigKit: Kit = {
  kitId: 'big',
  name: 'Big test kit',
  instruments: Array.from({ length: DEFAULT_CLIP_ROWS + 2 }, (_, i): KitInstrument => {
    const id = `voice-${i}`
    return { instrumentId: id, name: `Voice ${i}`, artwork: `${id}.svg`, sound: `${id}.wav` }
  }),
}

describe('SequencerEngine', () => {
  let driver: FakeAudioDriver
  let engine: SequencerEngine

  beforeEach(async () => {
    driver = new FakeAudioDriver()
    engine = await createSequencerEngine({ kit, driver })
  })

  describe('kit and pattern state', () => {
    it('loads the kit samples up front so the first tap is audible', () => {
      expect(driver.loaded).toEqual([
        { instrumentId: 'kick', url: 'kick.wav' },
        { instrumentId: 'snare', url: 'snare.wav' },
        { instrumentId: 'boop', url: 'boop.wav' },
      ])
    })

    it('starts with an empty grid of the roster’s first rows, in kit order', () => {
      const pattern = engine.getPattern()
      expect(pattern.map((row) => row.instrumentId)).toEqual(['kick', 'snare', 'boop'])
      expect(pattern.every((row) => row.steps.length === 16)).toBe(true)
      expect(pattern.every((row) => row.steps.every((on) => !on))).toBe(true)
    })

    it('exposes pattern edits as readable state, not an event stream', () => {
      engine.setCell('snare', 4, true)
      expect(engine.getPattern()[1]?.steps[4]).toBe(true)
      engine.setCell('snare', 4, false)
      expect(engine.getPattern()[1]?.steps[4]).toBe(false)
    })

    it('returns a snapshot that later edits do not mutate', () => {
      const before = engine.getPattern()
      engine.setCell('kick', 0, true)
      expect(before[0]?.steps[0]).toBe(false)
    })

    it('replaces the whole grid via setPattern', () => {
      engine.setPattern([
        { instrumentId: 'kick', steps: row([0, 8]) },
        { instrumentId: 'snare', steps: row([4]) },
        { instrumentId: 'boop', steps: row([]) },
      ])
      expect(engine.getPattern()[0]?.steps[8]).toBe(true)
      expect(engine.getPattern()[1]?.steps[4]).toBe(true)
    })

    it('rejects unknown instruments and out-of-range steps', () => {
      expect(() => engine.setCell('cowbell', 0, true)).toThrow(/cowbell/)
      expect(() => engine.setCell('kick', 16, true)).toThrow(/step/)
      expect(() => engine.setPattern([{ instrumentId: 'kick', steps: [true] }])).toThrow()
    })
  })

  describe('dynamic clip rows', () => {
    let bigDriver: FakeAudioDriver
    let big: SequencerEngine

    beforeEach(async () => {
      bigDriver = new FakeAudioDriver()
      big = await createSequencerEngine({ kit: bigKit, driver: bigDriver })
    })

    it('defaults a fresh grid to the roster’s first six rows, empty', () => {
      const pattern = big.getPattern()
      expect(pattern.map((row) => row.instrumentId)).toEqual([
        'voice-0',
        'voice-1',
        'voice-2',
        'voice-3',
        'voice-4',
        'voice-5',
      ])
      expect(pattern).toHaveLength(DEFAULT_CLIP_ROWS)
      expect(pattern.every((row) => row.steps.every((on) => !on))).toBe(true)
    })

    it('gives a roster smaller than the default all of it', () => {
      expect(engine.getPattern().map((row) => row.instrumentId)).toEqual(['kick', 'snare', 'boop'])
    })

    it('takes the row set from setPattern - membership and order included', () => {
      big.setPattern([
        { instrumentId: 'voice-7', steps: row([1]) },
        { instrumentId: 'voice-2', steps: row([]) },
      ])
      expect(big.getPattern().map((r) => r.instrumentId)).toEqual(['voice-7', 'voice-2'])
      expect(big.getPattern()[0]?.steps[1]).toBe(true)
    })

    it('plays exactly its own rows, in pattern-row order - not kit order', async () => {
      big.setPattern([
        { instrumentId: 'voice-7', steps: row([0]) },
        { instrumentId: 'voice-2', steps: row([0]) },
      ])
      await big.start()
      bigDriver.played = []
      const events: BeatEvent[] = []
      const off = big.onBeat((e) => events.push(e))
      bigDriver.fireStep()
      off()

      expect(events[0]?.hits).toEqual([{ instrumentId: 'voice-7' }, { instrumentId: 'voice-2' }])
      expect(bigDriver.played).toEqual([
        { instrumentId: 'voice-7', audioTime: 0.1 },
        { instrumentId: 'voice-2', audioTime: 0.1 },
      ])
    })

    it('never sounds an instrument the pattern has dropped', async () => {
      big.setCell('voice-1', 0, true)
      big.setPattern([{ instrumentId: 'voice-0', steps: row([0]) }])
      await big.start()
      bigDriver.played = []
      bigDriver.fireStep()

      expect(bigDriver.played).toEqual([{ instrumentId: 'voice-0', audioTime: 0.1 }])
    })

    it('accepts a single row - the floor of the model', () => {
      big.setPattern([{ instrumentId: 'voice-3', steps: row([2]) }])
      expect(big.getPattern().map((r) => r.instrumentId)).toEqual(['voice-3'])
    })

    it('accepts the whole roster - its ceiling', () => {
      big.setPattern(
        bigKit.instruments.map((i) => ({ instrumentId: i.instrumentId, steps: row([]) })),
      )
      expect(big.getPattern()).toHaveLength(bigKit.instruments.length)
    })

    it('rejects an empty row list, a duplicate row and an instrument the kit lacks', () => {
      expect(() => big.setPattern([])).toThrow(/at least one row/)
      expect(() =>
        big.setPattern([
          { instrumentId: 'voice-0', steps: row([]) },
          { instrumentId: 'voice-0', steps: row([1]) },
        ]),
      ).toThrow(/twice/)
      expect(() => big.setPattern([{ instrumentId: 'cowbell', steps: row([]) }])).toThrow(/cowbell/)
    })

    it('leaves the grid alone when any row is bad', () => {
      big.setCell('voice-0', 0, true)
      expect(() =>
        big.setPattern([
          { instrumentId: 'voice-1', steps: row([4]) },
          { instrumentId: 'voice-1', steps: row([5]) },
        ]),
      ).toThrow()
      expect(big.getPattern().map((r) => r.instrumentId)).toHaveLength(DEFAULT_CLIP_ROWS)
      expect(big.getPattern()[0]?.steps[0]).toBe(true)
    })

    it('refuses a cell on an instrument this clip has no row for', () => {
      expect(() => big.setCell('voice-7', 0, true)).toThrow(/voice-7/)
    })

    it('loads every kit instrument once, whatever rows the pattern holds', () => {
      expect(bigDriver.loaded.map((s) => s.instrumentId)).toEqual(
        bigKit.instruments.map((i) => i.instrumentId),
      )
      big.setPattern([{ instrumentId: 'voice-0', steps: row([]) }])
      expect(bigDriver.loaded).toHaveLength(bigKit.instruments.length)
    })
  })

  describe('pitched rows', () => {
    it('carries the painted notes as readable state, beside the steps projection', () => {
      engine.setPattern([pitchedRow('boop', { 0: [4], 4: [0, 2, 7] })])

      const [boop] = engine.getPattern()
      expect(boop?.pitches?.[0]).toBe(pitchMask(4))
      expect(boop?.pitches?.[4]).toBe(pitchMask(0) | pitchMask(2) | pitchMask(7))
      expect(boop?.steps.filter(Boolean)).toHaveLength(2)
    })

    it('returns a snapshot later edits do not mutate', () => {
      engine.setPattern([pitchedRow('boop', { 0: [4] })])
      const before = engine.getPattern()
      engine.setCell('boop', 0, true, 7)
      expect(before[0]?.pitches?.[0]).toBe(pitchMask(4))
    })

    it('rejects pitch data that does not describe 16 steps', () => {
      expect(() =>
        engine.setPattern([{ instrumentId: 'boop', steps: row([0]), pitches: [pitchMask(4)] }]),
      ).toThrow(/pitches/)
    })

    it('rejects a pitch mask that is not a byte of pitch bits', () => {
      for (const bad of [-1, 1.5, 256, Number.NaN]) {
        expect(() =>
          engine.setPattern([
            { instrumentId: 'boop', steps: row([0]), pitches: masks({ 0: bad }) },
          ]),
        ).toThrow(/pitches/)
      }
    })

    // `steps` is the any-note projection of `pitches` (spec §4); letting the
    // two drift would mean a painted note that never sounds, or a step that
    // sounds nothing.
    it('rejects pitch data the steps projection disagrees with', () => {
      expect(() =>
        engine.setPattern([
          { instrumentId: 'boop', steps: row([0, 5]), pitches: masks({ 0: pitchMask(4) }) },
        ]),
      ).toThrow(/pitches/)
    })

    it('leaves the grid alone when a row’s pitch data is bad', () => {
      engine.setCell('kick', 0, true)
      expect(() =>
        engine.setPattern([{ instrumentId: 'boop', steps: row([]), pitches: [] }]),
      ).toThrow()
      expect(engine.getPattern()[0]?.steps[0]).toBe(true)
    })

    it('schedules one play per painted note, all at the step’s own audio time', async () => {
      engine.setPattern([pitchedRow('boop', { 0: [0, 4, 7] })])
      await engine.start()
      driver.played = []

      driver.fireStep()

      // Three notes share one voice's worth of level (ADR 0062) - their
      // attacks are the same sample on the same audio frame.
      const gain = 1 / Math.sqrt(3)
      expect(driver.played).toEqual([
        { instrumentId: 'boop', audioTime: 0.1, semitones: -7, gain },
        { instrumentId: 'boop', audioTime: 0.1, semitones: 0, gain },
        { instrumentId: 'boop', audioTime: 0.1, semitones: 5, gain },
      ])
    })

    it('leaves a one-note column at full level, as a drum row is', async () => {
      engine.setPattern([
        { instrumentId: 'kick', steps: row([0]) },
        pitchedRow('boop', { 0: [2] }),
      ])
      await engine.start()
      driver.played = []

      driver.fireStep()

      expect(driver.played).toEqual([
        { instrumentId: 'kick', audioTime: 0.1 },
        { instrumentId: 'boop', audioTime: 0.1, semitones: -3 },
      ])
    })

    // Only the manifest can make an instrument transposable (`pitch.ts`'s
    // `semitonesForInstrument`), so pitch data on a one-note row is not a note
    // - it is a newer build's document read by this one. Spec §4 rules what
    // happens: the rhythm sounds on the base sample, and the data survives the
    // read (ADR 0067).
    describe('on an instrument the manifest has not flagged', () => {
      it('sounds one untransposed hit for the whole column', async () => {
        engine.setPattern([pitchedRow('kick', { 0: [0, 2, 7] })])
        await engine.start()
        driver.played = []

        driver.fireStep()

        expect(driver.played).toEqual([{ instrumentId: 'kick', audioTime: 0.1 }])
      })

      it('reports one hit naming no pitch', async () => {
        engine.setPattern([pitchedRow('kick', { 0: [0, 2, 7] })])
        const [first] = await startAndCollect(engine, 1)

        expect(first?.hits).toEqual([{ instrumentId: 'kick' }])
      })

      it('auditions the plain sample even when a pitch is named', async () => {
        await engine.start()
        engine.stop()
        driver.played = []

        engine.audition('kick', 7)

        expect(driver.played).toEqual([{ instrumentId: 'kick', audioTime: undefined }])
      })

      it('keeps the data, so a newer build still finds the melody', () => {
        engine.setPattern([pitchedRow('kick', { 0: [0, 2, 7] })])

        expect(engine.getPattern()[0]?.pitches?.[0]).toBe(
          pitchMask(0) | pitchMask(2) | pitchMask(7),
        )
      })
    })

    it('carries one hit per sounding note, low note first', async () => {
      engine.setPattern([pitchedRow('boop', { 0: [2, 6] })])
      const [first] = await startAndCollect(engine, 1)

      expect(first?.hits).toEqual([
        { instrumentId: 'boop', pitchIndex: 2 },
        { instrumentId: 'boop', pitchIndex: 6 },
      ])
    })

    // The whole point of the anchor rule (spec §3): every existing saved boop
    // and share link using a converted instrument sounds exactly as it did.
    it('sounds a row with no pitch data exactly as it does today', async () => {
      engine.setPattern([{ instrumentId: 'boop', steps: row([0]) }])
      await engine.start()
      driver.played = []
      const [first] = await startAndCollect(engine, 1)

      expect(driver.played).toEqual([{ instrumentId: 'boop', audioTime: 0.1 }])
      expect(first?.hits).toEqual([{ instrumentId: 'boop' }])
    })

    it('sounds the anchor pitch as the untransposed sample', async () => {
      engine.setPattern([pitchedRow('boop', { 0: [ANCHOR_PITCH_INDEX] })])
      await engine.start()
      driver.played = []
      driver.fireStep()

      expect(driver.played).toEqual([{ instrumentId: 'boop', audioTime: 0.1, semitones: 0 }])
    })

    // The unison +6dB guard (spec §5). One row cannot name a pitch twice - a
    // mask holds each note once - and `setPattern` already refuses to name an
    // instrument twice, so there is no route to two sources on one note.
    it('never schedules the same pitch of the same instrument twice on a step', async () => {
      engine.setPattern([pitchedRow('boop', { 0: [4] })])
      engine.setCell('boop', 0, true, 4)
      engine.setCell('boop', 0, true, 4)
      await engine.start()
      driver.played = []
      driver.fireStep()

      expect(driver.played).toEqual([{ instrumentId: 'boop', audioTime: 0.1, semitones: 0 }])
    })

    describe('setCell with a pitch', () => {
      it('adds to the column rather than replacing it - a column is a chord', () => {
        engine.setPattern([pitchedRow('boop', { 0: [4] })])
        engine.setCell('boop', 0, true, 7)

        expect(engine.getPattern()[0]?.pitches?.[0]).toBe(pitchMask(4) | pitchMask(7))
      })

      it('turns off just that note, leaving the rest of the chord sounding', () => {
        engine.setPattern([pitchedRow('boop', { 0: [1, 4] })])
        engine.setCell('boop', 0, false, 1)

        expect(engine.getPattern()[0]?.pitches?.[0]).toBe(pitchMask(4))
        expect(engine.getPattern()[0]?.steps[0]).toBe(true)
      })

      it('clears the step once the last note of the column goes', () => {
        engine.setPattern([pitchedRow('boop', { 0: [1] })])
        engine.setCell('boop', 0, false, 1)

        expect(engine.getPattern()[0]?.pitches?.[0]).toBe(0)
        expect(engine.getPattern()[0]?.steps[0]).toBe(false)
      })

      // A row only grows pitch data when a pitch is actually painted on it, so
      // nothing a child has already recorded moves: spec §3's anchor rule says
      // what those steps were, and this is where it is written down.
      it('gives a row with no pitch data the anchor on its existing steps', () => {
        engine.setPattern([{ instrumentId: 'boop', steps: row([2]) }])
        engine.setCell('boop', 8, true, 0)

        const [boop] = engine.getPattern()
        expect(boop?.pitches?.[2]).toBe(ANCHOR_PITCH_MASK)
        expect(boop?.pitches?.[8]).toBe(pitchMask(0))
      })

      it('leaves a row with no pitch data alone when no pitch is named', () => {
        engine.setCell('kick', 0, true)

        expect(engine.getPattern()[0]?.pitches).toBeUndefined()
      })

      // Clearing a cell is about the cell, not one note in it - that is what
      // the grid's drag-to-erase and Clear grid mean by "off".
      it('clears the whole column when no pitch is named', () => {
        engine.setPattern([pitchedRow('boop', { 0: [1, 4, 7] })])
        engine.setCell('boop', 0, false)

        expect(engine.getPattern()[0]?.pitches?.[0]).toBe(0)
        expect(engine.getPattern()[0]?.steps[0]).toBe(false)
      })

      it('paints the anchor when a pitched row is turned on with no pitch named', () => {
        engine.setPattern([pitchedRow('boop', { 0: [1] })])
        engine.setCell('boop', 9, true)

        expect(engine.getPattern()[0]?.pitches?.[9]).toBe(ANCHOR_PITCH_MASK)
      })

      it('refuses a pitch index outside the lane', () => {
        for (const bad of [-1, 8, 1.5, Number.NaN]) {
          expect(() => engine.setCell('boop', 0, true, bad)).toThrow(/pitch/)
        }
      })
    })

    describe('audition on toggle', () => {
      it('sounds the pitch that was tapped', async () => {
        await engine.start()
        engine.stop()
        engine.setPattern([pitchedRow('boop', {})])
        driver.played = []

        engine.setCell('boop', 3, true, 7)

        expect(driver.played).toEqual([
          { instrumentId: 'boop', audioTime: undefined, semitones: 5 },
        ])
      })

      it('stays quiet for a note that was already painted', async () => {
        await engine.start()
        engine.stop()
        engine.setPattern([pitchedRow('boop', { 3: [7] })])
        driver.played = []

        engine.setCell('boop', 3, true, 7)

        expect(driver.played).toEqual([])
      })

      it('sounds the new note when a chord grows under a finger', async () => {
        await engine.start()
        engine.stop()
        engine.setPattern([pitchedRow('boop', { 3: [7] })])
        driver.played = []

        engine.setCell('boop', 3, true, 0)

        expect(driver.played).toEqual([
          { instrumentId: 'boop', audioTime: undefined, semitones: -7 },
        ])
      })
    })
  })

  describe('audition(instrumentId)', () => {
    it('plays the tapped pitch when one is named - the lane’s tap-to-hear', async () => {
      await engine.start()
      engine.stop()
      driver.played = []
      engine.audition('boop', 0)
      expect(driver.played).toEqual([{ instrumentId: 'boop', audioTime: undefined, semitones: -7 }])
    })

    it('ignores a pitch index outside the lane rather than throwing at a tap', async () => {
      await engine.start()
      driver.played = []
      expect(() => engine.audition('boop', 99)).not.toThrow()
      expect(driver.played).toEqual([])
    })

    it('plays the sample now when the context is running', async () => {
      await engine.start()
      engine.stop()
      driver.played = []
      engine.audition('boop')
      expect(driver.played).toEqual([{ instrumentId: 'boop', audioTime: undefined }])
    })

    it('unlocks first when the tap that called it is the first gesture', async () => {
      engine.audition('snare')
      expect(driver.played).toEqual([])
      await Promise.resolve()
      expect(driver.unlockCalls).toBe(1)
      expect(driver.played).toEqual([{ instrumentId: 'snare', audioTime: undefined }])
    })

    it('sounds even while the loop is running - the tap is its own sound', async () => {
      await engine.start()
      driver.played = []
      engine.audition('kick')
      expect(driver.played).toEqual([{ instrumentId: 'kick', audioTime: undefined }])
    })

    it('touches neither the pattern nor the transport', async () => {
      await engine.start()
      engine.stop()
      const before = engine.getPattern()
      engine.audition('kick')
      expect(engine.getPattern()).toEqual(before)
      expect(engine.isPlaying()).toBe(false)
      expect(driver.transportRunning).toBe(false)
    })

    it('ignores an instrument the kit does not know, rather than throwing at a tap', async () => {
      await engine.start()
      driver.played = []
      expect(() => engine.audition('cowbell')).not.toThrow()
      expect(driver.played).toEqual([])
    })

    it('auditions a kit instrument this clip has no row for - the picker browses by ear', async () => {
      const bigDriver = new FakeAudioDriver()
      const big = await createSequencerEngine({ kit: bigKit, driver: bigDriver })
      await big.start()
      bigDriver.played = []
      big.audition('voice-7')
      expect(bigDriver.played).toEqual([{ instrumentId: 'voice-7', audioTime: undefined }])
    })
  })

  describe('beat events', () => {
    it('emits one event per step including empty steps', async () => {
      const events = await startAndCollect(engine, 3)
      expect(events.map((e) => e.hits)).toEqual([[], [], []])
    })

    it('carries the hits sounding on the step, in pattern-row order', async () => {
      engine.setCell('boop', 0, true)
      engine.setCell('kick', 0, true)
      const [first] = await startAndCollect(engine, 1)
      expect(first?.hits).toEqual([{ instrumentId: 'kick' }, { instrumentId: 'boop' }])
    })

    it('keeps tick monotonic across the pattern boundary and derives step from it', async () => {
      const events = await startAndCollect(engine, 18)
      expect(events.map((e) => e.tick)).toEqual([...Array(18).keys()])
      expect(events.map((e) => e.step).slice(15, 18)).toEqual([15, 0, 1])
    })

    it('reports the audio time the step will sound', async () => {
      driver.advanceTo(2)
      const [first] = await startAndCollect(engine, 1)
      expect(first?.audioTime).toBeCloseTo(2.1)
    })

    it('plays each hit at the step audio time, not immediately', async () => {
      await engine.start()
      engine.setCell('kick', 0, true)
      driver.played = []
      await startAndCollect(engine, 1)
      expect(driver.played).toEqual([{ instrumentId: 'kick', audioTime: 0.1 }])
    })

    it('stops delivering to unsubscribed listeners', async () => {
      const seen: BeatEvent[] = []
      const off = engine.onBeat((e) => seen.push(e))
      await engine.start()
      driver.fireStep()
      off()
      driver.fireStep()
      expect(seen).toHaveLength(1)
    })
  })

  describe('draw-time subscription', () => {
    it('delivers the same event, but only once its audio time arrives', async () => {
      const drawn: BeatEvent[] = []
      engine.onDrawBeat((e) => drawn.push(e))
      await engine.start()
      driver.fireStep()
      expect(drawn).toHaveLength(0)

      driver.advanceTo(0.1)
      expect(drawn).toHaveLength(1)
      expect(drawn[0]?.tick).toBe(0)
    })

    it('drops draws for steps that pausing means will never be drawn', async () => {
      const drawn: BeatEvent[] = []
      engine.onDrawBeat((e) => drawn.push(e))
      await engine.start()
      driver.fireStep()
      engine.stop()

      driver.advanceTo(0.1)
      expect(drawn).toEqual([])
    })
  })

  describe('songPos()', () => {
    it('is zero before the transport has ever run', () => {
      expect(engine.songPos()).toBe(0)
    })

    it('interpolates continuously between scheduled beats', async () => {
      engine.setTempo(120) // 0.125 s per step
      await engine.start()
      driver.fireStep()
      driver.advanceTo(0.1)
      expect(engine.songPos()).toBeCloseTo(0)
      driver.advanceTo(0.1625)
      expect(engine.songPos()).toBeCloseTo(0.5)
    })

    it('re-anchors on each scheduled beat', async () => {
      engine.setTempo(120)
      await engine.start()
      driver.fireStep()
      driver.advanceTo(0.225)
      driver.fireStep() // tick 1, sounding at 0.325
      driver.advanceTo(0.325)
      expect(engine.songPos()).toBeCloseTo(1)
    })

    it('reads zero the moment a start follows a mid-loop stop', async () => {
      engine.setTempo(120)
      await engine.start()
      driver.fireStep()
      driver.advanceTo(0.1625) // half way through tick 0
      engine.stop()

      driver.advanceTo(1)
      await engine.start()
      expect(engine.songPos()).toBe(0)
    })

    it('moves from the top right away, without waiting for the first beat', async () => {
      engine.setTempo(120)
      await engine.start()
      driver.fireStep()
      driver.advanceTo(0.1625)
      engine.stop()

      driver.advanceTo(1)
      await engine.start()
      driver.advanceTo(1.0625)
      expect(engine.songPos()).toBeCloseTo(0.5) // half a step in, counted from the top
    })

    it('does not jump when the tempo changes mid-loop', async () => {
      engine.setTempo(120)
      await engine.start()
      driver.fireStep()
      driver.advanceTo(0.1625)
      expect(engine.songPos()).toBeCloseTo(0.5)

      engine.setTempo(60) // 0.25 s per step
      expect(engine.songPos()).toBeCloseTo(0.5)
      driver.advanceTo(0.2875)
      expect(engine.songPos()).toBeCloseTo(1)
    })

    it('rests at the top while the transport is stopped — there is no paused position', async () => {
      engine.setTempo(120)
      await engine.start()
      driver.fireStep()
      driver.advanceTo(0.1625)
      engine.stop()
      expect(engine.songPos()).toBe(0)
      driver.advanceTo(5)
      expect(engine.songPos()).toBe(0)
    })
  })

  describe('seek(tick)', () => {
    it('moves the playhead there at once while playing, and keeps advancing', async () => {
      engine.setTempo(120) // 0.125 s per step
      await engine.start()
      driver.fireStep()
      driver.advanceTo(0.1625) // half way through tick 0

      engine.seek(32)

      expect(engine.songPos()).toBeCloseTo(32)
      driver.advanceTo(0.225) // half a step later
      expect(engine.songPos()).toBeCloseTo(32.5)
    })

    it('never steps backwards when the target’s own step is scheduled', async () => {
      // That step is scheduled a lookahead early, so the raw position sits behind
      // the target until it sounds. The playhead must hold, not jump back.
      engine.setTempo(120) // 0.125 s per step
      await engine.start()
      driver.fireStep()
      driver.advanceTo(0.1625)

      engine.seek(32)
      driver.fireStep() // tick 32, sounding 0.1 s from now

      expect(engine.songPos()).toBeCloseTo(32)
      driver.advanceTo(0.2625) // the step sounds
      expect(engine.songPos()).toBeCloseTo(32)
      driver.advanceTo(0.325) // half a step further on
      expect(engine.songPos()).toBeCloseTo(32.5)
    })

    it('sounds the next scheduled step from the target', async () => {
      await engine.start()
      driver.fireStep()
      engine.seek(32)
      const events = await startAndCollect(engine, 2)
      expect(events.map((e) => e.tick)).toEqual([32, 33])
    })

    it('moves the playhead while stopped, and a later start resumes from there', async () => {
      await engine.start()
      driver.fireStep()
      driver.fireStep()
      engine.stop()

      engine.seek(20)

      expect(engine.songPos()).toBe(20)
      driver.advanceTo(1)
      expect(engine.songPos()).toBe(20) // stopped, so it does not drift
      const events = await startAndCollect(engine, 1)
      expect(events[0]?.tick).toBe(20)
    })

    it('drops the draws for steps scheduled before the jump', async () => {
      const drawn: BeatEvent[] = []
      engine.onDrawBeat((e) => drawn.push(e))
      await engine.start()
      driver.fireStep()

      engine.seek(32)

      driver.advanceTo(0.1)
      expect(drawn).toEqual([])
    })

    it('is not a transport event', async () => {
      const events = transportEvents(engine)
      await engine.start()
      driver.fireStep()
      engine.seek(32)
      engine.stop()
      engine.seek(0)
      expect(events).toEqual([{ type: 'started' }, { type: 'stopped' }])
    })

    it('clamps a negative target to the start of the song', async () => {
      await engine.start()
      driver.fireStep()
      engine.seek(-5)
      expect(engine.songPos()).toBeCloseTo(0)
      const events = await startAndCollect(engine, 1)
      expect(events[0]?.tick).toBe(0)
    })

    it('ignores a target that is not a finite number', async () => {
      await engine.start()
      driver.fireStep()
      engine.seek(32)
      engine.seek(Number.NaN)
      engine.seek(Number.POSITIVE_INFINITY)
      expect(engine.songPos()).toBeCloseTo(32)
      const events = await startAndCollect(engine, 1)
      expect(events[0]?.tick).toBe(32)
    })

    it('lands on a whole tick, so step stays an integer column', async () => {
      await engine.start()
      driver.fireStep()
      engine.seek(32.7)
      expect(engine.songPos()).toBeCloseTo(32)
      const events = await startAndCollect(engine, 1)
      expect(events[0]?.step).toBe(0)
    })
  })

  describe('transport', () => {
    it('unlocks audio from the gesture before starting', async () => {
      expect(engine.audioState()).toBe('locked')
      await engine.start()
      expect(driver.unlockCalls).toBe(1)
      expect(driver.transportRunning).toBe(true)
      expect(engine.isPlaying()).toBe(true)
    })

    it('emits started and stopped once each', async () => {
      const events = transportEvents(engine)
      await engine.start()
      await engine.start()
      engine.stop()
      engine.stop()
      expect(events).toEqual([{ type: 'started' }, { type: 'stopped' }])
      expect(engine.isPlaying()).toBe(false)
      expect(driver.transportRunning).toBe(false)
    })

    it('starts from the top after a stop, wherever in the loop it stopped', async () => {
      await engine.start()
      for (let i = 0; i < 8; i += 1) driver.fireStep() // stop mid-loop, at step 7
      engine.stop()
      const events = await startAndCollect(engine, 1)
      expect(events[0]?.tick).toBe(0)
      expect(events[0]?.step).toBe(0)
    })
  })

  describe('tempo', () => {
    it('defaults to the design default and pushes it to the driver', () => {
      expect(engine.getTempo()).toBe(DEFAULT_BPM)
      expect(driver.bpm).toBe(DEFAULT_BPM)
    })

    it('rounds to an integer, clamps to the slider range, and announces the change', () => {
      const events = transportEvents(engine)
      engine.setTempo(128.4)
      engine.setTempo(9000)
      engine.setTempo(1)
      expect(engine.getTempo()).toBe(60)
      expect(driver.bpm).toBe(60)
      expect(events).toEqual([
        { type: 'tempoChanged', bpm: 128 },
        { type: 'tempoChanged', bpm: 200 },
        { type: 'tempoChanged', bpm: 60 },
      ])
    })

    it('stays quiet when the rounded tempo is unchanged', () => {
      const events = transportEvents(engine)
      engine.setTempo(128)
      engine.setTempo(128.2)
      expect(events).toEqual([{ type: 'tempoChanged', bpm: 128 }])
    })

    it('ignores a tempo that is not a finite number', () => {
      engine.setTempo(Number.NaN)
      expect(engine.getTempo()).toBe(DEFAULT_BPM)
    })
  })

  describe('audition on toggle', () => {
    it('plays the sample when a cell is turned on while stopped', async () => {
      await engine.start()
      engine.stop()
      driver.played = []
      engine.setCell('snare', 3, true)
      expect(driver.played).toEqual([{ instrumentId: 'snare', audioTime: undefined }])
    })

    it('does not audition when a cell is turned off', async () => {
      await engine.start()
      engine.stop()
      engine.setCell('snare', 3, true)
      driver.played = []
      engine.setCell('snare', 3, false)
      expect(driver.played).toEqual([])
    })

    it('does not audition while the loop is running — the step will sound it', async () => {
      await engine.start()
      engine.setCell('snare', 3, true)
      expect(driver.played).toEqual([])
    })

    it('unlocks audio first when the cell tap is the first gesture', async () => {
      engine.setCell('snare', 3, true)
      expect(driver.played).toEqual([])
      await Promise.resolve()
      expect(driver.unlockCalls).toBe(1)
      expect(driver.played).toEqual([{ instrumentId: 'snare', audioTime: undefined }])
    })

    it('does not audition a cell that was already on', async () => {
      await engine.start()
      engine.stop()
      engine.setCell('snare', 3, true)
      driver.played = []
      engine.setCell('snare', 3, true)
      expect(driver.played).toEqual([])
    })
  })

  describe('audio interruption (iPadOS)', () => {
    it('stops the loop and reports the state when the context is interrupted', async () => {
      const states: string[] = []
      engine.onAudioState((s) => states.push(s))
      const transport = transportEvents(engine)
      await engine.start()

      driver.setState('interrupted')

      expect(engine.audioState()).toBe('interrupted')
      expect(engine.isPlaying()).toBe(false)
      expect(driver.transportRunning).toBe(false)
      expect(states).toEqual(['running', 'interrupted'])
      expect(transport).toEqual([{ type: 'started' }, { type: 'stopped' }])
    })

    it('plays again after a fresh start gesture', async () => {
      await engine.start()
      driver.setState('interrupted')
      await engine.start()
      expect(engine.audioState()).toBe('running')
      expect(engine.isPlaying()).toBe(true)
    })
  })

  it('stops, and leaves the injected driver to whoever owns it', async () => {
    await engine.start()
    engine.dispose()
    expect(driver.disposed).toBe(false)
    expect(driver.transportRunning).toBe(false)
    expect(engine.isPlaying()).toBe(false)
  })

  it('a second engine over the same driver still sounds once the first is disposed', async () => {
    // React's dev double-mount builds two engines over the one injected driver
    // and throws the first away. Disposing it must not take the driver — its
    // samples and output bus — down with it, or the live engine plays silence.
    const second = await createSequencerEngine({ kit, driver })
    engine.dispose()

    second.setCell('kick', 0, true)
    await second.start()
    driver.played = []
    driver.fireStep()

    expect(driver.played).toEqual([{ instrumentId: 'kick', audioTime: 0.1 }])
  })

  function transportEvents(engine: SequencerEngine): TransportEvent[] {
    const events: TransportEvent[] = []
    engine.onTransport((e) => events.push(e))
    return events
  }

  /** Start the transport (if needed) and fire `count` steps, collecting the beat events. */
  async function startAndCollect(engine: SequencerEngine, count: number): Promise<BeatEvent[]> {
    const events: BeatEvent[] = []
    const off = engine.onBeat((e) => events.push(e))
    if (!engine.isPlaying()) await engine.start()
    for (let i = 0; i < count; i += 1) driver.fireStep()
    off()
    return events
  }
})

/**
 * The one definition of "a fresh grid" (ADR 0042), so the engine's own
 * starting pattern, a Blank clip, a sample clip's rows and decode's fallback
 * cannot drift apart.
 */
describe('blankPattern', () => {
  it("is the roster's first six rows, nothing painted", () => {
    const pattern = blankPattern(bigKit)

    expect(pattern.map((r) => r.instrumentId)).toEqual([
      'voice-0',
      'voice-1',
      'voice-2',
      'voice-3',
      'voice-4',
      'voice-5',
    ])
    expect(pattern.every((r) => r.steps.length === STEPS_PER_PATTERN)).toBe(true)
    expect(pattern.every((r) => r.steps.every((on) => !on))).toBe(true)
  })

  it('gives a roster smaller than the default all of it', () => {
    expect(blankPattern(kit).map((r) => r.instrumentId)).toEqual(['kick', 'snare', 'boop'])
  })

  it('is exactly what a fresh engine starts on', async () => {
    const fresh = await createSequencerEngine({ kit: bigKit, driver: new FakeAudioDriver() })

    expect(fresh.getPattern()).toEqual(blankPattern(bigKit))
    expect(fresh.getPattern()).toHaveLength(DEFAULT_CLIP_ROWS)
  })
})

function row(activeSteps: number[]): boolean[] {
  return Array.from({ length: 16 }, (_, step) => activeSteps.includes(step))
}

/** 16 pitch masks, `byStep` naming the ones that are not empty. */
function masks(byStep: Record<number, number>): number[] {
  return Array.from({ length: STEPS_PER_PATTERN }, (_, step) => byStep[step] ?? 0)
}

/** A pitched row: `notes` maps a step to the pitch indexes painted in its column. */
function pitchedRow(instrumentId: string, notes: Record<number, number[]>): PatternRow {
  const pitches = Array.from({ length: STEPS_PER_PATTERN }, (_, step) =>
    (notes[step] ?? []).reduce((mask, pitchIndex) => mask | pitchMask(pitchIndex), 0),
  )
  return { instrumentId, steps: pitches.map((mask) => mask !== 0), pitches }
}
