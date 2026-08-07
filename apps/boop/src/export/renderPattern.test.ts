import { describe, expect, it } from 'vitest'

import type { Kit, Pattern } from '../engine/sequencerEngine.ts'
import { renderPatternSamples } from './renderPattern.ts'

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

describe('renderPatternSamples', () => {
  it('places a hit at its step offset, scaled by voice and master gain', () => {
    const kit = kitOf('kick')
    const pattern: Pattern = [rowOf('kick', 0)]
    // bpm 60 -> secondsPerStep = 60/60/4 = 0.25s; sampleRate 4 -> 1 sample/step.
    const out = renderPatternSamples({
      kit,
      pattern,
      bpm: 60,
      loops: 1,
      sampleRate: 4,
      samples: { kick: new Float32Array([1, 1]) },
    })

    // voiceGain 0.5 * masterGain 0.6 = 0.3
    expect(out[0]).toBeCloseTo(0.3)
    expect(out[1]).toBeCloseTo(0.3)
  })

  it('repeats the pattern for each loop', () => {
    const kit = kitOf('kick')
    const pattern: Pattern = [rowOf('kick', 0)]
    const out = renderPatternSamples({
      kit,
      pattern,
      bpm: 60,
      loops: 2,
      sampleRate: 4,
      samples: { kick: new Float32Array([1]) },
    })

    // 16 steps/loop * 1 sample/step = 16 samples between loop starts.
    expect(out[0]).toBeCloseTo(0.3)
    expect(out[16]).toBeCloseTo(0.3)
  })

  it('leaves silent steps at zero', () => {
    const kit = kitOf('kick')
    const pattern: Pattern = [rowOf('kick', 4)]
    const out = renderPatternSamples({
      kit,
      pattern,
      bpm: 60,
      loops: 1,
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
    const out = renderPatternSamples({
      kit,
      pattern,
      bpm: 60,
      loops: 1,
      sampleRate: 4,
      samples: {
        a: new Float32Array([1]),
        b: new Float32Array([1]),
        c: new Float32Array([1]),
        d: new Float32Array([1]),
        e: new Float32Array([1]),
      },
    })

    // 5 voices at gain 0.3 each = 1.5 raw, clamped to the [-1, 1] file range.
    expect(out[0]).toBe(1)
  })

  it('pads the tail so a hit near the end of the render is not cut off', () => {
    const kit = kitOf('kick')
    const pattern: Pattern = [rowOf('kick', 15)]
    const out = renderPatternSamples({
      kit,
      pattern,
      bpm: 60,
      loops: 1,
      sampleRate: 4,
      samples: { kick: new Float32Array([1, 1, 1]) }, // 3-sample tail past the last step
    })

    expect(out.length).toBeGreaterThanOrEqual(15 + 3)
    expect(out[15]).toBeCloseTo(0.3)
    expect(out[16]).toBeCloseTo(0.3)
    expect(out[17]).toBeCloseTo(0.3)
  })

  it('ignores a hit for an instrument whose sample failed to decode', () => {
    const kit = kitOf('kick')
    const pattern: Pattern = [rowOf('kick', 0)]
    const out = renderPatternSamples({
      kit,
      pattern,
      bpm: 60,
      loops: 1,
      sampleRate: 4,
      samples: {},
    })

    expect(out.every((sample) => sample === 0)).toBe(true)
  })
})
