import { beforeEach, describe, expect, it } from 'vitest'

import { createSequencerEngine } from './createSequencerEngine.ts'
import {
  DEFAULT_BPM,
  type BeatEvent,
  type Kit,
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

    it('starts with an empty grid, one row per kit instrument in kit order', () => {
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

  describe('beat events', () => {
    it('emits one event per step including empty steps', async () => {
      const events = await startAndCollect(engine, 3)
      expect(events.map((e) => e.hits)).toEqual([[], [], []])
    })

    it('carries the hits sounding on the step, in kit order', async () => {
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

    it('keeps moving from where it paused, without waiting for the next beat', async () => {
      engine.setTempo(120)
      await engine.start()
      driver.fireStep()
      driver.advanceTo(0.1625) // half way through tick 0
      engine.stop()

      driver.advanceTo(1)
      await engine.start()
      driver.advanceTo(1.0625)
      expect(engine.songPos()).toBeCloseTo(1) // half a step further on, no jump back
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

    it('freezes where it was when the transport stops', async () => {
      engine.setTempo(120)
      await engine.start()
      driver.fireStep()
      driver.advanceTo(0.1625)
      engine.stop()
      driver.advanceTo(5)
      expect(engine.songPos()).toBeCloseTo(0.5)
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

    it('resumes where it paused rather than resetting the tick', async () => {
      await engine.start()
      driver.fireStep()
      driver.fireStep()
      engine.stop()
      const events = await startAndCollect(engine, 1)
      expect(events[0]?.tick).toBe(2)
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

  it('stops and disposes the driver', async () => {
    await engine.start()
    engine.dispose()
    expect(driver.disposed).toBe(true)
    expect(driver.transportRunning).toBe(false)
    expect(engine.isPlaying()).toBe(false)
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

function row(activeSteps: number[]): boolean[] {
  return Array.from({ length: 16 }, (_, step) => activeSteps.includes(step))
}
