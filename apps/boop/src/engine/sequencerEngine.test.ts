import { beforeEach, describe, expect, it } from 'vitest'

import { createSequencerEngine } from './createSequencerEngine.ts'
import {
  blankPattern,
  DEFAULT_BPM,
  DEFAULT_CLIP_ROWS,
  STEPS_PER_PATTERN,
  type BeatEvent,
  type Kit,
  type KitInstrument,
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
    { instrumentId: 'boop', name: 'Boop', artwork: 'boop.svg', sound: 'boop.wav' },
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

  describe('audition(instrumentId)', () => {
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
 * The one definition of "a fresh grid" (ADR 0041), so the engine's own
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
