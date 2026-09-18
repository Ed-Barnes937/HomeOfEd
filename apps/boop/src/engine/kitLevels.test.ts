import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { MASTER_GAIN, chordGain } from './audioDriver.ts'
import { parseKitManifest } from './kitManifest.ts'
import { semitonesFromAnchor } from './pitch.ts'
import { PITCHES_PER_LANE } from './sequencerEngine.ts'

/**
 * Ticket 18's data-side check on the shipped launch kit's one-shots, extended
 * to the whole 20-instrument roster (instruments ticket 01): short, level-
 * capped, and no build-up when retriggered at the top of the tempo range.
 *
 * The ids come from the manifest, never a list in here - kits are pure data
 * and nothing outside `kit.json` may enumerate instrument ids.
 *
 * Kit data plus the one number the data has to fit under: `MASTER_GAIN`, the
 * master bus's headroom, which ticket 08 sized from the worst case measured
 * here. No engine code depends on this file.
 */

const SAMPLE_RATE = 44100
const STEPS_PER_BAR = 16
const STEP_SECONDS = 60 / 200 / 4 // one 16th note at 200 BPM
/** Per-voice ceiling the generator normalises to, plus 16-bit rounding slack. */
const VOICE_PEAK = 0.5 + 0.001
/**
 * The manifest roster painted solid at 200 bpm, one voice each: measured 3.035
 * raw (ticket 08). Kept tight so no new or re-tuned voice can inflate it
 * unnoticed.
 */
const ROSTER_BUDGET = 3.1

/**
 * The master bus's stated worst case: every row of the activated roster solid
 * at 200 bpm with every lane cell painted, measured 3.325 raw (ADR 0062).
 * Asserted against `MASTER_GAIN` below, so raising it forces the gain down too
 * - and at 0.3 the budget is spent, so the next voice has to buy its own.
 */
const WORST_CASE_BUDGET = 3.33

/**
 * The instruments ticket 10 flags `pitched`. They live here rather than coming
 * from the manifest because nothing in `kit.json` is flagged until then (spec
 * §11's dormancy); ADR 0059 holds their registers, which do not affect level -
 * the lane transposes by the same -7..+5 semitones whatever the root note is.
 */
const PITCHED_IDS = ['marimba', 'trumpet', 'piano', 'doublebass']

function readWav(buffer: Buffer): Float32Array {
  const dataIndex = buffer.indexOf('data')
  const dataLength = buffer.readUInt32LE(dataIndex + 4)
  const dataOffset = dataIndex + 8
  const n = dataLength / 2
  const out = new Float32Array(n)
  for (let i = 0; i < n; i += 1) out[i] = buffer.readInt16LE(dataOffset + i * 2) / 32767
  return out
}

function peakOf(samples: Float32Array): number {
  let peak = 0
  for (const s of samples) peak = Math.max(peak, Math.abs(s))
  return peak
}

function sumOf(tracks: readonly Float32Array[]): Float32Array {
  const maxLength = Math.max(...tracks.map((t) => t.length))
  const sum = new Float32Array(maxLength)
  for (const track of tracks) {
    for (let i = 0; i < track.length; i += 1) sum[i] = (sum[i] ?? 0) + (track[i] ?? 0)
  }
  return sum
}

/**
 * Every track landing on every 16th of `bars` bars at 200 bpm - the dense
 * layered worst case the master gain is sized against. One hit per track per
 * step: `mergePatterns` unions layered clips by `instrumentId`, so the same
 * instrument sounding from two clips at once is still one voice.
 */
function denseTrain(tracks: readonly Float32Array[], bars: number): Float32Array {
  const stepSamples = Math.round(STEP_SECONDS * SAMPLE_RATE)
  const longest = Math.max(...tracks.map((t) => t.length))
  const steps = STEPS_PER_BAR * bars
  const out = new Float32Array(steps * stepSamples + longest)
  for (let step = 0; step < steps; step += 1) {
    const offset = step * stepSamples
    for (const track of tracks) {
      for (let i = 0; i < track.length; i += 1) {
        out[offset + i] = (out[offset + i] ?? 0) + (track[i] ?? 0)
      }
    }
  }
  return out
}

/** What `playbackRate = 2^(semitones/12)` does to a buffer, linearly interpolated. */
function repitch(samples: Float32Array, semitones: number): Float32Array {
  const rate = 2 ** (semitones / 12)
  const out = new Float32Array(Math.floor(samples.length / rate))
  for (let i = 0; i < out.length; i += 1) {
    const at = i * rate
    const low = Math.floor(at)
    const frac = at - low
    out[i] = (samples[low] ?? 0) * (1 - frac) + (samples[low + 1] ?? 0) * frac
  }
  return out
}

/** A full lane painted on one step: every pitch of `samples`, at `gain` each. */
function fullLaneChord(samples: Float32Array, gain: number): Float32Array[] {
  return Array.from({ length: PITCHES_PER_LANE }, (_, pitchIndex) =>
    repitch(samples, semitonesFromAnchor(pitchIndex)).map((s) => s * gain),
  )
}

describe('launch kit one-shot levels', () => {
  const publicDir = fileURLToPath(new URL('../../public/', import.meta.url))

  async function roster(): Promise<{ id: string; samples: Float32Array }[]> {
    const kit = parseKitManifest(JSON.parse(await readFile(`${publicDir}kits/launch/kit.json`, 'utf8')))
    return Promise.all(
      kit.instruments.map(async (instrument) => ({
        id: instrument.instrumentId,
        samples: readWav(await readFile(publicDir + instrument.sound.slice(1))),
      })),
    )
  }

  it('covers every instrument the manifest lists', async () => {
    expect((await roster()).length).toBe(20)
  })

  it('each one-shot is short with no long tail (< 400ms)', async () => {
    for (const { id, samples } of await roster()) {
      const durationMs = (samples.length / SAMPLE_RATE) * 1000
      expect(durationMs, `${id}.wav duration`).toBeLessThan(400)
    }
  })

  it('each one-shot stays inside the per-voice peak budget', async () => {
    for (const { id, samples } of await roster()) {
      expect(peakOf(samples), `${id}.wav peak`).toBeLessThanOrEqual(VOICE_PEAK)
    }
  })

  it('a dense hit of the classic six still sums to the level the engine was first tuned against', async () => {
    const classicSix = ['kick', 'snare', 'hat', 'tom', 'marimba', 'boop']
    const voices = await roster()
    const tracks = classicSix.map((id) => {
      const voice = voices.find((v) => v.id === id)
      if (!voice) throw new Error(`the manifest no longer carries ${id}`)
      return voice.samples
    })
    // The original six-voice figure the master bus was sized from, kept as a
    // historical pin: the classic six landing on one step sum to ~1.83 raw.
    // It is no longer the worst case - see the roster tests below - but a
    // change here would mean the six default rows had drifted.
    expect(peakOf(sumOf(tracks))).toBeLessThanOrEqual(1.83 + 0.05)
  })

  it('a dense hit of the whole roster stays inside the stated worst-case budget', async () => {
    const voices = await roster()
    // The six-row sum above is no longer the worst case: a clip may hold all
    // 20 rows, and layered clips sound their union - and because
    // `mergePatterns` unions rows by `instrumentId`, that union caps at the
    // roster, one voice per instrument per step. Measured: 2.970 raw (well
    // under the 10.0 the per-voice peaks would give if they all peaked in
    // phase, which they don't).
    expect(peakOf(sumOf(voices.map((v) => v.samples)))).toBeLessThanOrEqual(ROSTER_BUDGET)
  })

  it('the true worst case - every roster row painted solid at 200bpm - stays inside the budget', async () => {
    const voices = await roster()
    // The stated worst case (ticket 08): the whole-roster union retriggering
    // on every 16th at the top of the tempo range, so tails overlap on top of
    // the simultaneous sum. Measured: 3.035 raw - only 0.26 dB above the
    // single-step union, because the tails add incoherently.
    const dense = denseTrain(
      voices.map((v) => v.samples),
      4,
    )
    expect(peakOf(dense)).toBeLessThanOrEqual(ROSTER_BUDGET)
  })

  describe('a chord of a pitched lane', () => {
    /**
     * The voices ticket 10 activates: every one-shot in the kit's sounds
     * directory, which is the manifest's 20 plus the three ticket 04 added and
     * left unlisted. Read from disk rather than listed here, so activation does
     * not change what this measures.
     */
    async function activatedVoices(): Promise<{ id: string; samples: Float32Array }[]> {
      const soundsDir = `${publicDir}kits/launch/sounds/`
      const files = (await readdir(soundsDir)).filter((f) => f.endsWith('.wav')).sort()
      return Promise.all(
        files.map(async (file) => ({
          id: file.replace('.wav', ''),
          samples: readWav(await readFile(soundsDir + file)),
        })),
      )
    }

    /** Every voice solid at 200 bpm, the pitched ones with every lane cell painted. */
    async function pitchedWorstCase(gain: number): Promise<Float32Array> {
      const voices = await activatedVoices()
      expect(voices.map((v) => v.id)).toEqual(expect.arrayContaining(PITCHED_IDS))
      return denseTrain(
        voices.flatMap((v) =>
          PITCHED_IDS.includes(v.id) ? fullLaneChord(v.samples, gain) : [v.samples],
        ),
        4,
      )
    }

    it('leaves a single note at full level, so a drum row is untouched', () => {
      expect(chordGain(1)).toBe(1)
    })

    it('keeps a full lane inside two voices, where eight raw notes would be five', async () => {
      // What "costs one voice" is worth in the real samples: doublebass is the
      // loudest, its repitched low notes running long enough to stay in step.
      for (const { id, samples } of await activatedVoices()) {
        if (!PITCHED_IDS.includes(id)) continue
        const chord = peakOf(sumOf(fullLaneChord(samples, chordGain(PITCHES_PER_LANE))))
        expect(chord / peakOf(samples), `${id} full lane against one note`).toBeLessThan(2)
      }
    })

    it('stays inside the budget with the chord law applied', async () => {
      // Measured 3.325 raw (ADR 0062): four lanes chording on top of the other
      // nineteen voices costs only 0.16 more than the same roster playing one
      // voice each, because the law hands a column one voice's worth of gain.
      expect(peakOf(await pitchedWorstCase(chordGain(PITCHES_PER_LANE)))).toBeLessThanOrEqual(
        WORST_CASE_BUDGET,
      )
    })

    it('would clip without it', async () => {
      // Why the law exists: eight notes of one sample start on the same audio
      // frame, so their attacks add coherently. Measured 4.553 raw - 1.37 at
      // the master gain, and the `Limiter(-1)` cannot catch a transient.
      expect(peakOf(await pitchedWorstCase(1)) * MASTER_GAIN).toBeGreaterThan(1)
    })
  })

  it('the stated budget still fits under full scale once the master gain is applied', () => {
    // The assertion that makes the budget above mean something: the gain
    // staging has to close. `MASTER_GAIN` is sized so the worst case cannot
    // reach full scale on its own, because the `Limiter(-1)` behind it is a
    // backstop and not a peak controller - see `audioDriver.ts` for the
    // measurement. If a new or re-tuned voice pushes the budget up, this test
    // goes red and the gain has to come down with it.
    expect(WORST_CASE_BUDGET * MASTER_GAIN).toBeLessThanOrEqual(1)
  })

  it('retriggering at 200bpm 16th notes does not build up level (a real one-shot, not a drone)', async () => {
    const hitsPerTrain = 8
    const stepSamples = Math.round(STEP_SECONDS * SAMPLE_RATE)
    for (const { id, samples } of await roster()) {
      const singlePeak = peakOf(samples)
      const train = new Float32Array(stepSamples * hitsPerTrain + samples.length)
      for (let hit = 0; hit < hitsPerTrain; hit += 1) {
        const offset = hit * stepSamples
        for (let i = 0; i < samples.length; i += 1) {
          train[offset + i] = (train[offset + i] ?? 0) + (samples[i] ?? 0)
        }
      }
      const trainPeak = peakOf(train)
      // A decaying one-shot's overlapping tails add a little headroom, but
      // a sustained/looping sample would build far past this. The cymbal's
      // full 400ms tail passes because noise adds incoherently (spec §10.3).
      expect(trainPeak / singlePeak, `${id} retrigger buildup`).toBeLessThan(1.4)
    }
  })
})
