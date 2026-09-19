/**
 * Builds the pitched lane's four root samples from real recordings
 * (`public/kits/launch/sounds/{marimba,trumpet,piano,doublebass}.wav`).
 *
 *   node apps/boop/scripts/sourceInstrumentSamples.mjs             # all four
 *   node apps/boop/scripts/sourceInstrumentSamples.mjs trumpet     # named voices
 *
 * Source: nbrosowsky/tonejs-instruments, whose samples are CC BY 3.0 and come
 * from VSCO2 Community Edition. Needs network; nothing at build or test time
 * runs it, and its output is committed. The kit's ATTRIBUTION.txt carries the
 * credit this licence requires.
 *
 * Upstream ships 44.1 kHz mono 16-bit WAV beside its MP3, which is already the
 * kit's format, so there is no decode and no resample here - only the envelope
 * work, which is the whole difficulty: these are 2.6 s to 10 s orchestral
 * notes and the kit's one-shots are capped at 400 ms with a retrigger rule at
 * 200 bpm. See docs/adr/0065.
 */
import { Buffer } from 'node:buffer'
import { writeFileSync } from 'node:fs'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'

import { SAMPLE_RATE, readWav, wav } from './wav.mjs'

const BASE = 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples'

/** Peak level per voice, shared with every other voice in the kit. */
const PEAK = 0.5

/**
 * Per-voice recipe. `from` names the upstream file, `transpose` the semitones
 * it is shifted by to land on `rootNote`, and the envelope fields say how a
 * long orchestral note is made into a one-shot: `holdMs` is how much of the
 * natural note survives untouched, then an
 * exponential fall of `decayDb` over the rest, and `releaseMs` of raised
 * cosine so the cut is not a click.
 */
const voices = {
  /** A struck bar is already a one-shot: it needs cutting, not shaping. */
  marimba: {
    from: 'xylophone/G4',
    rootNote: 'G4',
    transpose: 0,
    holdMs: 0,
    decayDb: 0,
    seconds: 0.39,
    releaseMs: 40,
  },
  /** Flat sustain for 7 s, so the whole envelope is imposed here. */
  trumpet: {
    from: 'trumpet/G4',
    rootNote: 'G4',
    transpose: 0,
    holdMs: 70,
    decayDb: 48,
    seconds: 0.34,
    releaseMs: 80,
  },
  piano: {
    from: 'piano/G3',
    rootNote: 'G3',
    transpose: 0,
    holdMs: 45,
    decayDb: 46,
    seconds: 0.32,
    releaseMs: 70,
  },
  /**
   * Every contrabass upstream is bowed, and G2 is not among them. C2 is the
   * fastest-blooming note in the set (full level by 120 ms against Gs2's
   * 450 ms), and the +7 shortening takes that bloom to 80 ms - which `holdMs`
   * then keeps whole, so the onset the lane hears is the real bow and not a
   * fade of ours.
   */
  doublebass: {
    from: 'contrabass/C2',
    rootNote: 'G2',
    transpose: 7,
    holdMs: 80,
    decayDb: 42,
    seconds: 0.36,
    releaseMs: 90,
  },
}

const soundsDir = fileURLToPath(new URL('../public/kits/launch/sounds/', import.meta.url))
const requested = process.argv.slice(2)
const ids = requested.length > 0 ? requested : Object.keys(voices)

for (const id of ids) {
  const recipe = voices[id]
  if (!recipe) throw new Error(`no recipe for ${id}`)
  const source = await download(`${BASE}/${recipe.from}.wav`)
  const samples = build(readWav(source), recipe)
  writeFileSync(`${soundsDir}${id}.wav`, wav(samples))
  process.stdout.write(
    `${id.padEnd(11)} ${recipe.from.padEnd(16)} ${recipe.transpose >= 0 ? '+' : ''}${recipe.transpose}st -> ` +
      `${recipe.rootNote.padEnd(3)}  ${((samples.length / SAMPLE_RATE) * 1000).toFixed(0)}ms\n`,
  )
}

async function download(url) {
  const response = await globalThis.fetch(url)
  const body = Buffer.from(await response.arrayBuffer())
  // The raw host answers a missing path with a 14-byte body under HTTP 200.
  if (body.subarray(0, 4).toString() !== 'RIFF') throw new Error(`not a WAV: ${url}`)
  return body
}

function build(source, recipe) {
  const pitched = repitch(source, recipe.transpose)
  const start = onsetOf(pitched)
  const length = Math.min(Math.round(recipe.seconds * SAMPLE_RATE), pitched.length - start)
  const out = pitched.slice(start, start + length)
  decay(out, recipe.holdMs, recipe.decayDb)
  release(out, recipe.releaseMs)
  attack(out)
  return normalise(out)
}

/** What `playbackRate = 2^(semitones/12)` does to a buffer, linearly interpolated. */
function repitch(samples, semitones) {
  if (semitones === 0) return Float32Array.from(samples)
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

/** The first sample above 2% of the file's peak: where the note actually starts. */
function onsetOf(samples) {
  const threshold = peakOf(samples) * 0.02
  for (let i = 0; i < samples.length; i += 1) if (Math.abs(samples[i]) > threshold) return i
  return 0
}

/** Leaves `holdMs` of the natural note, then falls `decayDb` by the end. */
function decay(samples, holdMs, decayDb) {
  if (decayDb === 0) return
  const hold = Math.round((holdMs / 1000) * SAMPLE_RATE)
  const span = samples.length - hold
  if (span <= 0) return
  const rate = (decayDb / 20) * Math.LN10
  for (let i = hold; i < samples.length; i += 1) {
    samples[i] *= Math.exp((-rate * (i - hold)) / span)
  }
}

/** Raised cosine, so the truncation is a note ending rather than a click. */
function release(samples, releaseMs) {
  const fade = Math.min(Math.round((releaseMs / 1000) * SAMPLE_RATE), samples.length)
  for (let i = 0; i < fade; i += 1) {
    samples[samples.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fade)
  }
}

/** 2 ms in, matching the generator's declick: the transient survives, the click does not. */
function attack(samples) {
  const fade = Math.min(Math.round(0.002 * SAMPLE_RATE), samples.length)
  for (let i = 0; i < fade; i += 1) samples[i] *= i / fade
}

function normalise(samples) {
  const peak = peakOf(samples)
  return peak === 0 ? samples : samples.map((s) => (s / peak) * PEAK)
}

function peakOf(samples) {
  let peak = 0
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  return peak
}
