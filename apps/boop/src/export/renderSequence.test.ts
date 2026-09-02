import { describe, expect, it } from 'vitest'

import { MASTER_GAIN } from '../engine/audioDriver.ts'
import type { Kit, Pattern } from '../engine/sequencerEngine.ts'
import { renderSequenceSamples } from './renderSequence.ts'

function kitOf(...instrumentIds: string[]): Kit {
  return {
    kitId: 'test',
    name: 'Test kit',
    instruments: instrumentIds.map((instrumentId) => ({
      instrumentId,
      name: instrumentId,
      artwork: '',
      sound: `${instrumentId}.wav`,
    })),
  }
}

/** A 16-step row, on only at the given steps. */
function rowOf(instrumentId: string, ...onSteps: number[]): { instrumentId: string; steps: boolean[] } {
  const steps = new Array<boolean>(16).fill(false)
  for (const step of onSteps) steps[step] = true
  return { instrumentId, steps }
}

describe('renderSequenceSamples', () => {
  it('places a hit at its step offset, scaled by the one master gain live playback uses', () => {
    const kit = kitOf('kick')
    const pattern: Pattern = [rowOf('kick', 0)]
    // bpm 60 -> secondsPerStep = 60/60/4 = 0.25s; sampleRate 4 -> 1 sample/step.
    const out = renderSequenceSamples({
      kit,
      sequence: [pattern],
      bpm: 60,
      sampleRate: 4,
      samples: { kick: new Float32Array([1, 1]) },
    })

    // The exported file must be as loud as the app, so one decoded sample
    // through the render is exactly `MASTER_GAIN` - the same constant
    // `ToneAudioDriver` puts on the live master bus, and the only gain either
    // path applies. A second per-voice gain in here made exports 6 dB quieter
    // than playback (ticket 08).
    expect(out[0]).toBeCloseTo(MASTER_GAIN)
    expect(out[1]).toBeCloseTo(MASTER_GAIN)
  })

  it('renders each pass of the sequence in order', () => {
    const kit = kitOf('kick')
    const pattern: Pattern = [rowOf('kick', 0)]
    const out = renderSequenceSamples({
      kit,
      sequence: [pattern, pattern],
      bpm: 60,
      sampleRate: 4,
      samples: { kick: new Float32Array([1]) },
    })

    // 16 steps/pass * 1 sample/step = 16 samples between pass starts.
    expect(out[0]).toBeCloseTo(0.3)
    expect(out[16]).toBeCloseTo(0.3)
  })

  it('renders different patterns per pass — each slot sounds its own clip', () => {
    const kit = kitOf('kick', 'snare')
    const kickOnly: Pattern = [rowOf('kick', 0)]
    const snareOnly: Pattern = [rowOf('snare', 0)]
    const out = renderSequenceSamples({
      kit,
      sequence: [kickOnly, snareOnly],
      bpm: 60,
      sampleRate: 4,
      samples: { kick: new Float32Array([1]), snare: new Float32Array([-1]) },
    })

    expect(out[0]).toBeCloseTo(0.3)
    expect(out[16]).toBeCloseTo(-0.3)
  })

  it('leaves silent steps at zero', () => {
    const kit = kitOf('kick')
    const pattern: Pattern = [rowOf('kick', 4)]
    const out = renderSequenceSamples({
      kit,
      sequence: [pattern],
      bpm: 60,
      sampleRate: 4,
      samples: { kick: new Float32Array([1]) },
    })

    expect(out[0]).toBe(0)
    expect(out[3]).toBe(0)
    expect(out[4]).toBeCloseTo(0.3)
  })

  it('sums hits from several instruments on the same step and clamps rather than clips silently past full scale', () => {
    const kit = kitOf('a', 'b', 'c', 'd', 'e')
    const pattern: Pattern = [rowOf('a', 0), rowOf('b', 0), rowOf('c', 0), rowOf('d', 0), rowOf('e', 0)]
    const out = renderSequenceSamples({
      kit,
      sequence: [pattern],
      bpm: 60,
      sampleRate: 4,
      samples: {
        a: new Float32Array([1]),
        b: new Float32Array([1]),
        c: new Float32Array([1]),
        d: new Float32Array([1]),
        e: new Float32Array([1]),
      },
    })

    // 5 voices at MASTER_GAIN each sums past full scale, so the file's hard
    // ceiling takes it. Live, `MASTER_GAIN` is sized so the roster's worst
    // case cannot get here (`toneAudioDriver.ts`); these are unit-peak
    // samples, four times the kit's own per-voice peak.
    expect(5 * MASTER_GAIN).toBeGreaterThan(1)
    expect(out[0]).toBe(1)
  })

  it('pads the tail so a hit near the end of the render is not cut off', () => {
    const kit = kitOf('kick')
    const pattern: Pattern = [rowOf('kick', 15)]
    const out = renderSequenceSamples({
      kit,
      sequence: [pattern],
      bpm: 60,
      sampleRate: 4,
      samples: { kick: new Float32Array([1, 1, 1]) }, // 3-sample tail past the last step
    })

    expect(out.length).toBeGreaterThanOrEqual(15 + 3)
    expect(out[15]).toBeCloseTo(0.3)
    expect(out[16]).toBeCloseTo(0.3)
    expect(out[17]).toBeCloseTo(0.3)
  })

  it('renders passes whose row sets differ in count and in instrument', () => {
    // Ticket 08: a clip owns its rows (ADR 0042), so consecutive passes can
    // hold wholly different rosters. Pass 1 is one row, pass 2 is three, and
    // they share only `b`.
    const kit = kitOf('a', 'b', 'c', 'd')
    const onePass: Pattern = [rowOf('b', 0)]
    const threeRows: Pattern = [rowOf('b', 0), rowOf('c', 0), rowOf('d', 0)]
    const out = renderSequenceSamples({
      kit,
      sequence: [onePass, threeRows],
      bpm: 60,
      sampleRate: 4,
      samples: {
        a: new Float32Array([1]),
        b: new Float32Array([1]),
        c: new Float32Array([1]),
        d: new Float32Array([1]),
      },
    })

    // Pass 1: `b` only. `a` is in the kit but in neither pattern, so it never
    // sounds - the rows are the clip's, not the kit's.
    expect(out[0]).toBeCloseTo(MASTER_GAIN)
    // Pass 2: three rows on step 0.
    expect(out[16]).toBeCloseTo(3 * MASTER_GAIN)
  })

  it('a row of all-off steps contributes nothing', () => {
    const kit = kitOf('kick', 'snare')
    const pattern: Pattern = [rowOf('kick', 0), rowOf('snare')]
    const out = renderSequenceSamples({
      kit,
      sequence: [pattern],
      bpm: 60,
      sampleRate: 4,
      samples: { kick: new Float32Array([1]), snare: new Float32Array([1]) },
    })

    // Only the kick sounds: an empty row is a row, not a hit on every step.
    expect(out[0]).toBeCloseTo(MASTER_GAIN)
    expect(out.slice(1).every((sample) => sample === 0)).toBe(true)
  })

  it('a pass whose every row is all-off renders silence, and still takes its 16 steps', () => {
    // A picked-but-unpainted clip placed in the song: it holds the slot.
    const kit = kitOf('kick')
    const unpainted: Pattern = [rowOf('kick')]
    const out = renderSequenceSamples({
      kit,
      sequence: [unpainted, [rowOf('kick', 0)]],
      bpm: 60,
      sampleRate: 4,
      samples: { kick: new Float32Array([1]) },
    })

    expect(out.slice(0, 16).every((sample) => sample === 0)).toBe(true)
    expect(out[16]).toBeCloseTo(MASTER_GAIN)
  })

  it('ignores a hit for an instrument whose sample failed to decode', () => {
    const kit = kitOf('kick')
    const pattern: Pattern = [rowOf('kick', 0)]
    const out = renderSequenceSamples({
      kit,
      sequence: [pattern],
      bpm: 60,
      sampleRate: 4,
      samples: {},
    })

    expect(out.every((sample) => sample === 0)).toBe(true)
  })
})
