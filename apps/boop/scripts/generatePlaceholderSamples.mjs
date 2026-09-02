/**
 * Generates the launch kit's placeholder one-shots
 * (`public/kits/launch/sounds/*.wav`). They are synthesized here rather than
 * sourced so the repo carries no third-party audio (see the kit's
 * ATTRIBUTION.txt for why CC0 one-shots weren't reachable); real artwork and
 * audio are ticket 28.
 *
 *   node apps/boop/scripts/generatePlaceholderSamples.mjs           # the 14 new voices
 *   node apps/boop/scripts/generatePlaceholderSamples.mjs zap drip  # named voices
 *
 * **Why the default is not "all 20".** The classic six on disk were rendered
 * by ticket 18's generator, which was never committed (its ATTRIBUTION entry
 * records the recipes). The six definitions below are ticket 12's originals
 * and no longer match those files sample-for-sample, so rebuilding them would
 * quietly change shipped audio. Naming one on the command line does exactly
 * that, deliberately - don't, unless a ticket asks for it.
 */
import { Buffer } from 'node:buffer'
import { mkdirSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'

const SAMPLE_RATE = 44100
/** Peak level per voice — balanced so six simultaneous rows do not clip. */
const PEAK = 0.5

/**
 * Kept short deliberately: a step is 75 ms at 200 BPM, and the spec asks for
 * one-shots with no long tails that stay clean at the top of the tempo range.
 * Every voice stays under 400 ms; the cymbal spends all of it on a noise tail,
 * which the retrigger check tolerates because noise adds incoherently
 * (spec §10.3). `kitLevels.test.ts` is the committed check on all of this.
 */
const voices = {
  // The classic six - ticket 12's definitions, superseded on disk by ticket 18
  // (see the header): not regenerated unless named on the command line.
  kick: () => sweep({ seconds: 0.22, from: 120, to: 45, decay: 20 }),
  snare: () =>
    mix(
      noise({ seconds: 0.15, decay: 34 }),
      sweep({ seconds: 0.15, from: 210, to: 170, decay: 40 }),
    ),
  hat: () => highpass(noise({ seconds: 0.05, decay: 110 })),
  tom: () => sweep({ seconds: 0.2, from: 190, to: 95, decay: 22 }),
  marimba: () =>
    mix(
      sweep({ seconds: 0.24, from: 523.25, to: 523.25, decay: 18 }),
      scale(sweep({ seconds: 0.24, from: 2093, to: 2093, decay: 40 }), 0.35),
    ),
  boop: () => sweep({ seconds: 0.18, from: 880, to: 620, decay: 22 }),

  // Drums.
  /** Three staggered bursts, 909-style - one noise seed re-struck, then a body. */
  clap: () =>
    mix(
      highpass(noise({ seconds: 0.02, decay: 240, seed: 5 })),
      delayed(highpass(noise({ seconds: 0.02, decay: 240, seed: 5 })), 0.009),
      delayed(highpass(noise({ seconds: 0.02, decay: 240, seed: 5 })), 0.018),
      delayed(scale(highpass(noise({ seconds: 0.12, decay: 38, seed: 17 })), 0.55), 0.026),
    ),
  /** A soft high-passed noise pair; `levels` keeps it under the hat. */
  shaker: () =>
    mix(
      highpass(noise({ seconds: 0.045, decay: 95, seed: 7 })),
      delayed(scale(highpass(noise({ seconds: 0.05, decay: 75, seed: 21 })), 0.7), 0.03),
    ),
  /** Two inharmonic mid partials, honky and quick - the 808 cowbell interval. */
  cowbell: () =>
    mix(
      sweep({ seconds: 0.16, from: 540, to: 540, decay: 26 }),
      scale(sweep({ seconds: 0.16, from: 800, to: 800, decay: 26 }), 0.8),
    ),
  /** A resonant mid tick with a click transient for the mallet. */
  woodblock: () =>
    mix(
      sweep({ seconds: 0.09, from: 1150, to: 1100, decay: 55 }),
      scale(highpass(noise({ seconds: 0.004, decay: 400, seed: 3 })), 0.5),
    ),
  /** A high inharmonic stack: shimmery, and short enough not to build up. */
  triangle: () =>
    mix(
      sweep({ seconds: 0.26, from: 4200, to: 4200, decay: 20 }),
      scale(sweep({ seconds: 0.26, from: 5750, to: 5750, decay: 24 }), 0.6),
      scale(sweep({ seconds: 0.26, from: 7300, to: 7300, decay: 28 }), 0.4),
    ),
  /**
   * Bright noise across the whole 390 ms the 400 ms cap allows (spec §10.3).
   * What the retrigger rule constrains is the decay, not the length: noise
   * does add incoherently, but eight overlapping hits still sum in *power*,
   * and slow tails (6.5 with a 3.0 layer under it) measured 1.74x at 200 bpm
   * (spec §10.3's ~1.16 prediction was optimistic). These decays keep the
   * tail audible to ~368 ms (within 1% of peak) and measure 1.20x.
   */
  cymbal: () =>
    highpass(
      mix(
        noise({ seconds: 0.39, decay: 14, seed: 11 }),
        scale(noise({ seconds: 0.39, decay: 9, seed: 29 }), 0.25),
      ),
    ),

  // Notes.
  /**
   * The low anchor the kit lacked: a ~90 Hz sine pluck with a little snap.
   * Decay 14 measured 1.40x retriggered - a 90 Hz tail overlaps nearly in
   * phase at 75 ms, so it needs the shorter one.
   */
  bass: () =>
    mix(
      sweep({ seconds: 0.24, from: 96, to: 88, decay: 19 }),
      scale(sweep({ seconds: 0.1, from: 180, to: 176, decay: 34 }), 0.25),
    ),
  /** Glockenspiel-ish: C6 fundamental + an inharmonic upper partial. */
  bell: () =>
    mix(
      sweep({ seconds: 0.34, from: 1046.5, to: 1046.5, decay: 18 }),
      scale(sweep({ seconds: 0.34, from: 2888, to: 2888, decay: 22 }), 0.45),
    ),
  /** Stacked sparkly partials with a softened attack. */
  chime: () =>
    softAttack(
      mix(
        sweep({ seconds: 0.34, from: 1568, to: 1568, decay: 18 }),
        scale(sweep({ seconds: 0.34, from: 2350, to: 2350, decay: 21 }), 0.55),
        scale(sweep({ seconds: 0.34, from: 3136, to: 3136, decay: 24 }), 0.35),
      ),
      0.03,
    ),
  /** String-ish: harmonics whose decays stagger, so the tone brightens then dulls. */
  pluck: () =>
    mix(
      sweep({ seconds: 0.26, from: 330, to: 328, decay: 16 }),
      scale(sweep({ seconds: 0.26, from: 660, to: 660, decay: 22 }), 0.5),
      scale(sweep({ seconds: 0.26, from: 990, to: 990, decay: 30 }), 0.3),
      scale(sweep({ seconds: 0.26, from: 1320, to: 1320, decay: 38 }), 0.18),
    ),

  // Silly.
  /**
   * Springy: a falling pitch with a wobble on top. Decay 12 measured 1.50x
   * retriggered - the wobble does not decorrelate one hit from the next,
   * since every hit is the same waveform.
   */
  boing: () => vibrato({ seconds: 0.3, from: 320, to: 150, decay: 19, rate: 17, depth: 0.3 }),
  /** Bubble-wrap: a tiny upward blip and gone. */
  pop: () => sweep({ seconds: 0.04, from: 380, to: 1100, decay: 45 }),
  /** Laser: 2 kHz down to 200 Hz, fast. */
  zap: () => sweep({ seconds: 0.14, from: 2000, to: 200, decay: 18 }),
  /** A water drop: upward chirp with a tick of splash on the front. */
  drip: () =>
    mix(
      sweep({ seconds: 0.11, from: 620, to: 1700, decay: 26 }),
      scale(highpass(noise({ seconds: 0.006, decay: 300, seed: 9 })), 0.35),
    ),
}

/**
 * Voices whose character is "quieter than X" scale below the per-voice peak.
 * The ceiling still applies; this only lowers a voice inside it.
 */
const levels = {
  shaker: 0.55, // spec §2: softer than the hat
}

/** The voices this effort added - what a bare run rebuilds (see the header). */
const NEW_VOICE_IDS = [
  'clap',
  'shaker',
  'cowbell',
  'woodblock',
  'triangle',
  'cymbal',
  'bass',
  'bell',
  'chime',
  'pluck',
  'boing',
  'pop',
  'zap',
  'drip',
]

const requested = process.argv.slice(2)
const ids = requested.length > 0 ? requested : NEW_VOICE_IDS
const unknown = ids.filter((id) => !(id in voices))
if (unknown.length > 0) {
  process.stderr.write(`unknown voice(s): ${unknown.join(', ')}\n`)
  process.exit(1)
}

const outDir = fileURLToPath(new URL('../public/kits/launch/sounds/', import.meta.url))
mkdirSync(outDir, { recursive: true })
for (const id of ids) {
  const samples = declick(scale(normalise(voices[id]()), levels[id] ?? 1))
  writeFileSync(`${outDir}${id}.wav`, wav(samples))
  process.stdout.write(`${id}.wav — ${(samples.length / SAMPLE_RATE).toFixed(2)}s\n`)
}

function sweep({ seconds, from, to, decay }) {
  const length = Math.round(seconds * SAMPLE_RATE)
  const out = new Float32Array(length)
  let phase = 0
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE
    const progress = i / length
    const freq = from * Math.pow(to / from, progress)
    phase += (2 * Math.PI * freq) / SAMPLE_RATE
    out[i] = Math.sin(phase) * Math.exp(-decay * t)
  }
  return out
}

/**
 * A sine that both glides and wobbles - the springy voice Boing needs.
 * `depth` is the wobble as a fraction of the current pitch, `rate` its Hz.
 */
function vibrato({ seconds, from, to, decay, rate, depth }) {
  const length = Math.round(seconds * SAMPLE_RATE)
  const out = new Float32Array(length)
  let phase = 0
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE
    const glide = from * Math.pow(to / from, i / length)
    const freq = glide * (1 + depth * Math.sin(2 * Math.PI * rate * t))
    phase += (2 * Math.PI * freq) / SAMPLE_RATE
    out[i] = Math.sin(phase) * Math.exp(-decay * t)
  }
  return out
}

function noise({ seconds, decay, seed = 1 }) {
  const length = Math.round(seconds * SAMPLE_RATE)
  const out = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    // Deterministic LCG: regenerating the kit must not change the samples.
    seed = (seed * 1103515245 + 12345) % 2147483648
    out[i] = (seed / 1073741824 - 1) * Math.exp((-decay * i) / SAMPLE_RATE)
  }
  return out
}

/** One-pole difference — enough to turn white noise into a hi-hat tick. */
function highpass(samples) {
  const out = new Float32Array(samples.length)
  for (let i = 1; i < samples.length; i += 1) out[i] = samples[i] - samples[i - 1]
  return out
}

function mix(...tracks) {
  const length = Math.max(...tracks.map((t) => t.length))
  const out = new Float32Array(length)
  for (const track of tracks) for (let i = 0; i < track.length; i += 1) out[i] += track[i]
  return out
}

function scale(samples, factor) {
  return factor === 1 ? samples : samples.map((s) => s * factor)
}

/** Push a track later in time - how Clap and Shaker stagger their bursts. */
function delayed(samples, seconds) {
  const offset = Math.round(seconds * SAMPLE_RATE)
  const out = new Float32Array(samples.length + offset)
  for (let i = 0; i < samples.length; i += 1) out[offset + i] = samples[i]
  return out
}

/** A gentler onset than `declick`'s 2 ms - the Chime's softer attack. */
function softAttack(samples, seconds) {
  const ramp = Math.round(seconds * SAMPLE_RATE)
  const out = Float32Array.from(samples)
  for (let i = 0; i < ramp && i < out.length; i += 1) out[i] *= Math.sin((Math.PI / 2) * (i / ramp))
  return out
}

function normalise(samples) {
  let peak = 0
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  return peak === 0 ? samples : samples.map((s) => (s / peak) * PEAK)
}

/** 2 ms in, 4 ms out, so no voice starts or ends on a click. */
function declick(samples) {
  const fadeIn = Math.round(0.002 * SAMPLE_RATE)
  const fadeOut = Math.round(0.004 * SAMPLE_RATE)
  const out = Float32Array.from(samples)
  for (let i = 0; i < fadeIn && i < out.length; i += 1) out[i] *= i / fadeIn
  for (let i = 0; i < fadeOut && i < out.length; i += 1) {
    out[out.length - 1 - i] *= i / fadeOut
  }
  return out
}

/** 16-bit mono PCM WAV — the most universally decodable thing a browser can be handed. */
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    data.writeInt16LE(Math.round(clamped * 32767), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}
