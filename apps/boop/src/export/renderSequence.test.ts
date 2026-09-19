import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { MASTER_GAIN, chordGain } from '../engine/audioDriver.ts'
import { parseKitManifest } from '../engine/kitManifest.ts'
import { pitchMask, semitonesFromAnchor } from '../engine/pitch.ts'
import {
  ANCHOR_PITCH_INDEX,
  PITCHES_PER_LANE,
  STEPS_PER_PATTERN,
  type Kit,
  type Pattern,
  type PatternRow,
} from '../engine/sequencerEngine.ts'
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

/** The same kit with every instrument flagged pitched. ADR 0065's marimba register. */
function pitchedKitOf(...instrumentIds: string[]): Kit {
  const kit = kitOf(...instrumentIds)
  return {
    ...kit,
    instruments: kit.instruments.map((instrument) => ({
      ...instrument,
      pitched: { rootNote: 'G4', rootMidi: 67 },
    })),
  }
}

/** A 16-step row, on only at the given steps. */
function rowOf(instrumentId: string, ...onSteps: number[]): { instrumentId: string; steps: boolean[] } {
  const steps = new Array<boolean>(16).fill(false)
  for (const step of onSteps) steps[step] = true
  return { instrumentId, steps }
}

/** A row carrying notes: a pitch-index list per on step, the rest silent. */
function laneRowOf(
  instrumentId: string,
  notesByStep: Record<number, readonly number[]>,
): PatternRow {
  const pitches = new Array<number>(STEPS_PER_PATTERN).fill(0)
  for (const [step, pitchIndexes] of Object.entries(notesByStep)) {
    pitches[Number(step)] = pitchIndexes.reduce((mask, i) => mask | pitchMask(i), 0)
  }
  return { instrumentId, steps: pitches.map((mask) => mask !== 0), pitches }
}

function peakOf(samples: Float32Array): number {
  let peak = 0
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  return peak
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

/**
 * The render as it was before it knew about pitch: one copy of the sample at
 * unity rate on every on step, summed, times the master gain. Spec §3's
 * byte-identical guarantee is that the resampler still agrees with this
 * everywhere a note sits at the anchor, so it is written out longhand rather
 * than derived from the thing under test.
 */
function unpitchedReference(options: {
  kit: Kit
  sequence: readonly Pattern[]
  bpm: number
  sampleRate: number
  samples: Readonly<Record<string, Float32Array>>
}): Float32Array {
  const { kit, sequence, bpm, sampleRate, samples } = options
  const samplesPerStep = Math.round((60 / bpm / 4) * sampleRate)
  const totalSteps = STEPS_PER_PATTERN * sequence.length
  const longest = kit.instruments.reduce(
    (max, instrument) => Math.max(max, samples[instrument.instrumentId]?.length ?? 0),
    0,
  )
  const out = new Float32Array(totalSteps * samplesPerStep + longest)
  for (let tick = 0; tick < totalSteps; tick += 1) {
    const pattern = sequence[Math.floor(tick / STEPS_PER_PATTERN)]!
    const step = tick % STEPS_PER_PATTERN
    for (const instrument of kit.instruments) {
      const row = pattern.find((r) => r.instrumentId === instrument.instrumentId)
      if (!row?.steps[step]) continue
      const sample = samples[instrument.instrumentId]
      if (!sample) continue
      for (let i = 0; i < sample.length; i += 1) out[tick * samplesPerStep + i]! += sample[i]!
    }
  }
  for (let i = 0; i < out.length; i += 1) out[i] = Math.max(-1, Math.min(1, out[i]! * MASTER_GAIN))
  return out
}

/** Deterministic, non-monotonic sample data: a wrong resampler cannot fluke past it. */
function noisySample(length: number): Float32Array {
  const out = new Float32Array(length)
  let state = 12345
  for (let i = 0; i < length; i += 1) {
    state = (state * 1103515245 + 12345) % 2147483648
    out[i] = (state / 2147483648) * 0.8 - 0.4
  }
  return out
}

describe('renderSequenceSamples byte-identity at the anchor', () => {
  const samples = { kick: noisySample(37), boop: noisySample(53) }

  it('renders an unpitched row exactly as it did before pitch existed', () => {
    const kit = kitOf('kick', 'boop')
    const sequence = [
      [rowOf('kick', 0, 3, 15), rowOf('boop', 2, 15)],
      [rowOf('kick', 1), rowOf('boop', 0, 8)],
    ]
    const options = { kit, sequence, bpm: 120, sampleRate: 8000, samples }

    expect(renderSequenceSamples(options)).toEqual(unpitchedReference(options))
  })

  it('renders a pitched row with no notes of its own exactly the same way', () => {
    // The conversion rule (spec §3): an old boop's marimba row has no
    // `pitches`, reads as the anchor, and must sound untouched.
    const options = {
      kit: pitchedKitOf('kick', 'boop'),
      sequence: [[rowOf('kick', 0, 3, 15), rowOf('boop', 2, 15)]],
      bpm: 120,
      sampleRate: 8000,
      samples,
    }

    expect(renderSequenceSamples(options)).toEqual(unpitchedReference(options))
  })

  it('renders a pitched row whose every note is the anchor exactly the same way', () => {
    const anchor = [ANCHOR_PITCH_INDEX]
    const options = {
      kit: pitchedKitOf('kick', 'boop'),
      sequence: [
        [
          laneRowOf('kick', { 0: anchor, 3: anchor, 15: anchor }),
          laneRowOf('boop', { 2: anchor, 15: anchor }),
        ],
      ],
      bpm: 120,
      sampleRate: 8000,
      samples,
    }

    expect(renderSequenceSamples(options)).toEqual(unpitchedReference(options))
  })

  it('leaves an unflagged instrument alone even if its row somehow carries notes', () => {
    // Only the manifest can make an instrument transposable
    // (`semitonesForInstrument`), so an unflagged row renders at unity however
    // its pitches read - the export's half of "kits are pure data".
    const options = {
      kit: kitOf('kick'),
      sequence: [[laneRowOf('kick', { 0: [0], 4: [7] })]],
      bpm: 120,
      sampleRate: 8000,
      samples,
    }

    expect(renderSequenceSamples(options)).toEqual(
      unpitchedReference({ ...options, sequence: [[rowOf('kick', 0, 4)]] }),
    )
  })

  it('sounds a chord on an unflagged row once, not once per note', () => {
    // A newer build's document is the only way a one-note row carries a chord
    // (ADR 0067). Rendering it note by note would be several copies of one
    // untransposed sample on the same frame - a coherent unison the chord law
    // does not cover - so the column collapses to the single hit `steps` means.
    const options = {
      kit: kitOf('kick'),
      sequence: [[laneRowOf('kick', { 0: [0, 2, 4, 7] })]],
      bpm: 120,
      sampleRate: 8000,
      samples,
    }

    expect(renderSequenceSamples(options)).toEqual(
      unpitchedReference({ ...options, sequence: [[rowOf('kick', 0)]] }),
    )
  })
})

/**
 * f0 of a near-sine, from its interpolated positive-going zero crossings -
 * accurate to a small fraction of a cent on a clean tone, which is what the
 * synthetic sample below is. `scripts/measureSamplePitch.mjs` needs
 * autocorrelation because a marimba is not a sine; this does not.
 */
function fundamentalHz(frame: Float32Array, sampleRate: number): number {
  const crossings: number[] = []
  for (let i = 1; i < frame.length; i += 1) {
    const before = frame[i - 1]!
    const after = frame[i]!
    if (before <= 0 && after > 0) crossings.push(i - 1 + -before / (after - before))
  }
  const period = (crossings.at(-1)! - crossings[0]!) / (crossings.length - 1)
  return sampleRate / period
}

describe('renderSequenceSamples pitch', () => {
  const SAMPLE_RATE = 44100
  const ROOT_HZ = 440
  /** 30 bpm is a 0.5s step: the bottom note stretches to 0.375s and still fits. */
  const BPM = 30

  function sine(hz: number, seconds: number): Float32Array {
    const out = new Float32Array(Math.round(seconds * SAMPLE_RATE))
    for (let i = 0; i < out.length; i += 1) {
      out[i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE)
    }
    return out
  }

  it('renders each lane degree at the frequency the ladder in pitch.ts names', () => {
    const notesByStep = Object.fromEntries(
      [...Array(PITCHES_PER_LANE).keys()].map((pitchIndex) => [pitchIndex, [pitchIndex]]),
    )
    const out = renderSequenceSamples({
      kit: pitchedKitOf('tone'),
      sequence: [[laneRowOf('tone', notesByStep)]],
      bpm: BPM,
      sampleRate: SAMPLE_RATE,
      samples: { tone: sine(ROOT_HZ, 0.25) },
    })

    const samplesPerStep = Math.round((60 / BPM / 4) * SAMPLE_RATE)
    for (let pitchIndex = 0; pitchIndex < PITCHES_PER_LANE; pitchIndex += 1) {
      const start = pitchIndex * samplesPerStep
      const measured = fundamentalHz(out.subarray(start + 1000, start + 9000), SAMPLE_RATE)
      const expected = ROOT_HZ * 2 ** (semitonesFromAnchor(pitchIndex) / 12)
      const cents = 1200 * Math.log2(measured / expected)
      expect(Math.abs(cents), `degree ${pitchIndex} (${expected.toFixed(1)} Hz)`).toBeLessThan(1)
    }
  })

  it('makes room for the bottom note, which runs half as long again as the sample', () => {
    // Spec §5's accepted sampler physics: low is longer. The render's tail
    // padding has to cover it or the lowest note of the last step is cut off.
    const sample = noisySample(4000)
    const lastSounding = (pitchIndex: number): number => {
      const out = renderSequenceSamples({
        kit: pitchedKitOf('tone'),
        sequence: [[laneRowOf('tone', { 15: [pitchIndex] })]],
        bpm: BPM,
        sampleRate: SAMPLE_RATE,
        samples: { tone: sample },
      })
      let i = out.length - 1
      while (i >= 0 && out[i] === 0) i -= 1
      return i - 15 * Math.round((60 / BPM / 4) * SAMPLE_RATE)
    }

    expect(lastSounding(0) + 1).toBe(Math.floor(sample.length / 2 ** (-7 / 12)))
    expect(lastSounding(7) + 1).toBe(Math.floor(sample.length / 2 ** (5 / 12)))
  })
})

describe('renderSequenceSamples chord level', () => {
  const samples = { tone: noisySample(200) }

  /** The first rendered sample of a column: every note's own sample[0], at `chordGain`. */
  function onsetOf(pitchIndexes: readonly number[]): number {
    const out = renderSequenceSamples({
      kit: pitchedKitOf('tone'),
      sequence: [[laneRowOf('tone', { 0: pitchIndexes })]],
      bpm: 60,
      sampleRate: 44100,
      samples,
    })
    return out[0]!
  }

  it('plays every note of a column at the gain playback schedules it with', () => {
    // Ticket 09's law, imported from the one place it lives - `audioDriver.ts`,
    // which `ToneAudioDriver` reads too (ADR 0062). At the onset every note of
    // a column is the sample's own first frame, whatever its rate.
    const first = samples.tone[0]!
    for (const notes of [[4], [0, 4], [1, 3, 5], [0, 1, 2, 3, 4, 5, 6, 7]]) {
      expect(onsetOf(notes), `${notes.length}-note column`).toBeCloseTo(
        notes.length * first * chordGain(notes.length) * MASTER_GAIN,
        6,
      )
    }
  })

  it('leaves a single note at exactly the level a drum hit gets', () => {
    expect(onsetOf([ANCHOR_PITCH_INDEX])).toBe(Math.fround(samples.tone[0]! * MASTER_GAIN))
  })

})

/**
 * ADR 0062's worst case put through the real export rather than reconstructed:
 * the activated roster solid on every 16th at the top of the tempo range, the
 * four pitched rows holding a full lane. `kitLevels.test.ts` pins the raw sum
 * by construction; this pins the rendered file, so a resampler or a gain the
 * export applies differently would show up here as clipping.
 */
describe('the pitched worst case, rendered', () => {
  const publicDir = fileURLToPath(new URL('../../public/', import.meta.url))
  const FULL_LANE = [...Array(PITCHES_PER_LANE).keys()]

  function readWav(buffer: Buffer): Float32Array {
    const dataIndex = buffer.indexOf('data')
    const out = new Float32Array(buffer.readUInt32LE(dataIndex + 4) / 2)
    for (let i = 0; i < out.length; i += 1) {
      out[i] = buffer.readInt16LE(dataIndex + 8 + i * 2) / 32767
    }
    return out
  }

  /** The shipped kit and its audio - the activated roster, read rather than listed. */
  async function shippedRoster(): Promise<{ kit: Kit; samples: Record<string, Float32Array> }> {
    const kit = parseKitManifest(
      JSON.parse(await readFile(`${publicDir}kits/launch/kit.json`, 'utf8')),
    )
    const loaded = await Promise.all(
      kit.instruments.map(
        async (instrument) =>
          [instrument.instrumentId, readWav(await readFile(publicDir + instrument.sound.slice(1)))] as const,
      ),
    )
    return { kit, samples: Object.fromEntries(loaded) }
  }

  it('renders under full scale, so the export never reaches its hard ceiling', async () => {
    const { kit, samples } = await shippedRoster()
    expect(kit.instruments.filter((i) => i.pitched).map((i) => i.instrumentId)).toEqual([
      'marimba',
      'trumpet',
      'piano',
      'doublebass',
    ])

    const solid = [...Array(STEPS_PER_PATTERN).keys()]
    const everyCell: Record<number, readonly number[]> = {}
    for (const step of solid) everyCell[step] = FULL_LANE
    const pattern: Pattern = kit.instruments.map(({ instrumentId, pitched }) =>
      pitched ? laneRowOf(instrumentId, everyCell) : rowOf(instrumentId, ...solid),
    )

    const out = renderSequenceSamples({
      kit,
      sequence: [pattern, pattern, pattern, pattern],
      bpm: 200,
      sampleRate: 44100,
      samples,
    })

    // Measured 0.9265 rendered, 3.0884 raw - ADR 0065's 3.088 to the digit,
    // reached through the export rather than reconstructed. On the real
    // samples the *upper* bound is what proves the chords were rendered: the
    // same roster with no lane painted reaches 1.016, so a render that quietly
    // dropped them would fail `toBeLessThan(1)`. The lower bound is now only a
    // guard against a render that fell silent.
    expect(peakOf(out)).toBeLessThan(1)
    expect(peakOf(out)).toBeGreaterThan(0.9)
  })
})
