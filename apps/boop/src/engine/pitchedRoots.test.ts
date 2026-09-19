import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseKitManifest } from './kitManifest.ts'
import type { KitInstrument } from './sequencerEngine.ts'

/**
 * The root samples measured back off the shipped `.wav` files: that each one
 * really sounds the note the manifest says it does (ADR 0065, activated by
 * ticket 10). The registers used to live in this file, because nothing was
 * flagged `pitched` while the epic was dormant; `kit.json` carries them now, so
 * this suite reads them from there and asks only the question the manifest
 * cannot answer - what the audio actually is.
 *
 * Whether the registers agree on a key is `kitManifest.test.ts`'s assertion.
 */

const SAMPLE_RATE = 44100
/** Wide enough for a real recording's vibrato and bow noise, tight enough to catch a wrong note. */
const CENTS_TOLERANCE = 30
/**
 * The window the pitch is read over. A real note's attack is a transient, not
 * a pitch - a trumpet's scoop alone reads 15 cents sharp - so the reading
 * starts after it and stops before the release fade.
 */
const HEAD_START_MS = 60
const HEAD_END_MS = 260

function readWav(buffer: Buffer): Float32Array {
  const dataIndex = buffer.indexOf('data')
  const dataLength = buffer.readUInt32LE(dataIndex + 4)
  const out = new Float32Array(dataLength / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = buffer.readInt16LE(dataIndex + 8 + i * 2) / 32767
  }
  return out
}

/** Magnitude of `hz` in `samples` - one bin of a DFT, no FFT needed. */
function goertzel(samples: Float32Array, hz: number): number {
  const w = (2 * Math.PI * hz) / SAMPLE_RATE
  let re = 0
  let im = 0
  for (let i = 0; i < samples.length; i += 1) {
    re += (samples[i] ?? 0) * Math.cos(w * i)
    im += (samples[i] ?? 0) * Math.sin(w * i)
  }
  return Math.hypot(re, im)
}

const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

/**
 * The fundamental, as a MIDI number with a fractional part, found by harmonic
 * product over a chromatic sweep around the expected note.
 *
 * A *product* rather than a sum, because the two failure modes pull opposite
 * ways: a plain fundamental bin reads a struck bar as one of its own loud
 * partials, and a plain harmonic sum reads any note as the octave below it
 * (half a candidate's harmonics land on the real ones). Multiplying means a
 * candidate has to explain every harmonic, so both go away.
 */
function fundamentalMidiOf(samples: Float32Array, expectedMidi: number): number {
  // 1% of the magnitude a pure tone filling the window would give: the level
  // below which a harmonic counts as absent rather than merely quiet.
  let energy = 0
  for (const sample of samples) energy += sample * sample
  const floor = 0.01 * Math.sqrt(energy / samples.length) * (samples.length / 2)
  const score = (midi: number): number =>
    [1, 2, 3, 4].reduce(
      (total, h) => total + Math.log(floor + goertzel(samples, midiToHz(midi) * h)),
      0,
    )
  let best = expectedMidi - 12
  for (let midi = expectedMidi - 12; midi <= expectedMidi + 12; midi += 1) {
    if (score(midi) > score(best)) best = midi
  }
  for (let cents = -50; cents <= 50; cents += 2) {
    if (score(best + cents / 100) > score(best)) best += cents / 100
  }
  return best
}

describe('the pitched lane root samples', () => {
  const publicDir = fileURLToPath(new URL('../../public/', import.meta.url))

  async function pitchedInstruments(): Promise<KitInstrument[]> {
    const kit = parseKitManifest(
      JSON.parse(await readFile(`${publicDir}kits/launch/kit.json`, 'utf8')),
    )
    return kit.instruments.filter((instrument) => instrument.pitched !== undefined)
  }

  async function headOf(instrument: KitInstrument): Promise<Float32Array> {
    const samples = readWav(await readFile(publicDir + instrument.sound.slice(1)))
    const from = Math.round((HEAD_START_MS / 1000) * SAMPLE_RATE)
    const to = Math.min(Math.round((HEAD_END_MS / 1000) * SAMPLE_RATE), samples.length)
    return samples.subarray(from, to)
  }

  it('each one sounds the note its register names', async () => {
    const instruments = await pitchedInstruments()
    expect(instruments).not.toHaveLength(0)
    for (const instrument of instruments) {
      const { rootNote, rootMidi } = instrument.pitched!
      const measured = fundamentalMidiOf(await headOf(instrument), rootMidi)
      expect(
        Math.abs(measured - rootMidi) * 100,
        `${instrument.instrumentId} is not ${rootNote}`,
      ).toBeLessThan(CENTS_TOLERANCE)
    }
  })

  it('keeps the octave relationships the F-major layout was approved on', async () => {
    // Marimba and trumpet together at the top, piano an octave down,
    // doublebass an octave below that (ADR 0059, carried into ADR 0065).
    const instruments = await pitchedInstruments()
    const midiOf = (id: string): number =>
      instruments.find((i) => i.instrumentId === id)!.pitched!.rootMidi
    expect(midiOf('trumpet')).toBe(midiOf('marimba'))
    expect(midiOf('marimba') - midiOf('piano')).toBe(12)
    expect(midiOf('piano') - midiOf('doublebass')).toBe(12)
  })
})
