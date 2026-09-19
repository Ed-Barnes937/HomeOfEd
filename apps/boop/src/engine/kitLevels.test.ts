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
 * and nothing outside `kit.json` may enumerate instrument ids. `PITCHED_IDS`
 * below is the one exception, and only until ticket 10 flags them.
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
 * The manifest roster painted solid at 200 bpm, one voice each: measured 3.301
 * raw once marimba became a real xylophone recording (ADR 0065), up from 3.035
 * when it was synthesized. A struck bar's transient is 19.6 dB above its own
 * RMS and lands 5 ms in, right on the other voices' bodies - so this figure is
 * phase coincidence, not loudness, and trimming 1 ms off the front of the
 * sample swings it between 2.74 and 3.30. Still a tripwire against unnoticed
 * drift in a fixed set of files, but not a property of the kit.
 */
const ROSTER_BUDGET = 3.31
/** The same roster on one step rather than a solid train - far less sensitive. */
const SINGLE_HIT_BUDGET = 3.1

/**
 * The master bus's stated worst case: every row of the activated roster solid
 * at 200 bpm with every lane cell painted, measured 3.325 raw (ADR 0062) and
 * **3.088** on the real samples (ADR 0065) - a chord of real recordings adds
 * less coherently than a chord of synthesized tones. Held at 3.33 rather than
 * re-pinned down to the new figure, because it is what `MASTER_GAIN` is sized
 * against and 3.33 x 0.3 is already 0.999: tightening it would buy nothing and
 * would make the roster pin above the only thing with any slack.
 */
const WORST_CASE_BUDGET = 3.33

/**
 * The instruments ticket 10 flags `pitched`. They live here rather than coming
 * from the manifest because nothing in `kit.json` is flagged until then (spec
 * §11's dormancy); ADR 0065 holds their registers, which do not affect level -
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

function rmsOf(samples: Float32Array): number {
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / samples.length)
}

function countNotes(mask: number): number {
  return [...Array(PITCHES_PER_LANE).keys()].filter((bit) => mask & (1 << bit)).length
}

/** One column of a lane, as the row's pitch bitmask holds it, at `chordGain`. */
function chordOf(samples: Float32Array, mask: number): Float32Array[] {
  const gain = chordGain(countNotes(mask))
  return [...Array(PITCHES_PER_LANE).keys()]
    .filter((bit) => mask & (1 << bit))
    .map((pitchIndex) => repitch(samples, semitonesFromAnchor(pitchIndex)).map((s) => s * gain))
}

const FULL_LANE = (1 << PITCHES_PER_LANE) - 1

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
    // roster, one voice per instrument per step. Measured: 2.931 raw (well
    // under the 10.0 the per-voice peaks would give if they all peaked in
    // phase, which they don't).
    expect(peakOf(sumOf(voices.map((v) => v.samples)))).toBeLessThanOrEqual(SINGLE_HIT_BUDGET)
  })

  it('the true worst case - every roster row painted solid at 200bpm - stays inside the budget', async () => {
    const voices = await roster()
    // The stated worst case (ticket 08): the whole-roster union retriggering
    // on every 16th at the top of the tempo range, so tails overlap on top of
    // the simultaneous sum. Measured: 3.301 raw - 1.0 dB above the
    // single-step union, almost all of it the xylophone's mallet transient.
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

    /** Every voice solid at 200 bpm, the pitched ones holding `shape`. */
    async function pitchedDense(
      shape: (id: string) => number,
      notes: (samples: Float32Array, mask: number) => Float32Array[] = chordOf,
    ): Promise<Float32Array> {
      const voices = await activatedVoices()
      expect(voices.map((v) => v.id)).toEqual(expect.arrayContaining(PITCHED_IDS))
      return denseTrain(
        voices.flatMap((v) => (shape(v.id) === 0 ? [v.samples] : notes(v.samples, shape(v.id)))),
        4,
      )
    }

    const everyCell = (id: string): number => (PITCHED_IDS.includes(id) ? FULL_LANE : 0)

    it('leaves a single note at full level, so a drum row is untouched', () => {
      expect(chordGain(1)).toBe(1)
    })

    it('makes a full lane bigger than one note but not louder, and never quieter', async () => {
      for (const { id, samples } of await activatedVoices()) {
        if (!PITCHED_IDS.includes(id)) continue
        const chord = sumOf(chordOf(samples, FULL_LANE))
        // Upper bound: eight raw notes would peak at five voices, doublebass
        // loudest of all. Lower bound: adding notes must not duck the column.
        expect(peakOf(chord) / peakOf(samples), `${id} full lane peak`).toBeLessThan(2)
        expect(rmsOf(chord) / rmsOf(samples), `${id} full lane loudness`).toBeGreaterThan(0.5)
      }
    })

    it('stays inside the budget with the chord law applied', async () => {
      // Measured 3.088 raw (ADR 0065; 3.325 when these four were synthesized),
      // against 3.386 for the same roster playing one voice each: a column
      // costs one voice, so the budget holds.
      expect(peakOf(await pitchedDense(everyCell))).toBeLessThanOrEqual(WORST_CASE_BUDGET)
    })

    it('would clip without it', async () => {
      // Eight notes of one sample start on the same audio frame, so their
      // attacks add coherently. Measured 4.349 raw, 1.30 at the master gain.
      const raw = (samples: Float32Array, mask: number): Float32Array[] =>
        chordOf(samples, mask).map((note) => note.map((s) => s / chordGain(countNotes(mask))))
      expect(peakOf(await pitchedDense(everyCell, raw)) * MASTER_GAIN).toBeGreaterThan(1)
    })

    /**
     * The loudest of the 625 chord shapes `scripts/measureChordLevels.mjs`
     * searches, and the one case the budget above does **not** cover: 3.477
     * raw, 1.043 at the master gain, down from 3.787 on the synthesized
     * samples. It stays out of scope because the same search over which drum
     * rows are on reaches 3.703 with no pitch involved at all, so peak control
     * - not this constant - is what would fix it (ADR 0062, ADR 0065). Pinned
     * so the law cannot quietly make it worse; the shapes are the search's own
     * winners on the shipped audio, so they move when the audio does.
     */
    it('pins the shaped chord the budget does not cover, so it cannot grow', async () => {
      const shapes: Record<string, number> = {
        marimba: 0xdb,
        trumpet: 0xdd,
        piano: 0xb9,
        doublebass: 0xbb,
      }
      expect(peakOf(await pitchedDense((id) => shapes[id] ?? 0))).toBeLessThanOrEqual(3.48)
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
