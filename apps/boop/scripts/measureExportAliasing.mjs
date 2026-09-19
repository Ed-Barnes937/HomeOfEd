/**
 * Measures what linear interpolation costs the WAV export at the top of the
 * lane, so ticket 11 can keep it rather than reach for a heavier resampler.
 *
 *   node apps/boop/scripts/measureExportAliasing.mjs
 *
 * Two numbers per instrument, for each degree of the lane:
 *
 * - **fold** - the share of the source sample's energy that sits above
 *   `nyquist / rate`, which is the only content a downward resample can fold
 *   back as aliasing. Nothing above it, nothing to alias.
 * - **error** - RMS of (linear interpolation - a 64-tap Blackman-windowed sinc
 *   reference, cutoff scaled by the rate) against the reference's own RMS.
 *   It counts linear interpolation's high-frequency droop as well as its
 *   aliasing, so it is an upper bound on the damage.
 *
 * The pitched roster comes from kit.json (ADR 0067). Registers do not enter the
 * arithmetic - the lane transposes by the same -7..+5 semitones whatever the
 * root note is.
 */
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'

import { SAMPLE_RATE, readWav } from './wav.mjs'

const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11, 12]
const ANCHOR_PITCH_INDEX = 4
/** Half the kernel width of the reference resampler, in source samples. */
const SINC_HALF = 32

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
const PITCHED = JSON.parse(readFileSync(`${publicDir}kits/launch/kit.json`, 'utf8'))
  .instruments.filter((instrument) => instrument.pitched !== undefined)
  .map((instrument) => ({ id: instrument.instrumentId, sound: publicDir + instrument.sound.slice(1) }))

process.stdout.write(
  `nyquist ${SAMPLE_RATE / 2} Hz\n\n` +
    `${'instrument'.padEnd(12)}${MAJOR_SCALE_SEMITONES.map((_, i) =>
      `  ${semitonesFromAnchor(i) >= 0 ? '+' : ''}${semitonesFromAnchor(i)}st`.padStart(9),
    ).join('')}\n`,
)

for (const { id, sound } of PITCHED) {
  const samples = readWav(readFileSync(sound))
  const spectrum = energyByBin(samples)
  const fold = []
  const error = []
  for (let pitchIndex = 0; pitchIndex < MAJOR_SCALE_SEMITONES.length; pitchIndex += 1) {
    const rate = 2 ** (semitonesFromAnchor(pitchIndex) / 12)
    fold.push(db(shareAbove(spectrum, SAMPLE_RATE / 2 / Math.max(1, rate))))
    error.push(db(resamplerError(samples, rate)))
  }
  process.stdout.write(
    `${id.padEnd(12)}${fold.map((v) => `${v}`.padStart(9)).join('')}   fold\n` +
      `${''.padEnd(12)}${error.map((v) => `${v}`.padStart(9)).join('')}   error\n`,
  )
}

function semitonesFromAnchor(pitchIndex) {
  return MAJOR_SCALE_SEMITONES[pitchIndex] - MAJOR_SCALE_SEMITONES[ANCHOR_PITCH_INDEX]
}

function db(ratio) {
  return ratio === 0 ? '-inf' : (20 * Math.log10(ratio)).toFixed(1)
}

/** Linear interpolation, exactly as `renderSequence.ts` mixes a note. */
function linearResample(samples, rate) {
  const out = new Float32Array(Math.floor(samples.length / rate))
  for (let i = 0; i < out.length; i += 1) {
    const at = i * rate
    const low = Math.floor(at)
    const frac = at - low
    out[i] = (samples[low] ?? 0) * (1 - frac) + (samples[low + 1] ?? 0) * frac
  }
  return out
}

/** The band-limited answer: windowed sinc, cutoff dropped to `1/rate` when resampling down. */
function sincResample(samples, rate) {
  const out = new Float32Array(Math.floor(samples.length / rate))
  const cutoff = Math.min(1, 1 / rate)
  for (let i = 0; i < out.length; i += 1) {
    const at = i * rate
    const centre = Math.floor(at)
    let sum = 0
    for (let k = centre - SINC_HALF + 1; k <= centre + SINC_HALF; k += 1) {
      const sample = samples[k]
      if (sample === undefined) continue
      const x = at - k
      const phase = (Math.PI * x) / SINC_HALF
      const window = 0.42 + 0.5 * Math.cos(phase) + 0.08 * Math.cos(2 * phase)
      sum += sample * cutoff * sinc(cutoff * x) * window
    }
    out[i] = sum
  }
  return out
}

function sinc(x) {
  return x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
}

/** RMS of the difference between the two resamplers, over the reference's own RMS. */
function resamplerError(samples, rate) {
  const linear = linearResample(samples, rate)
  const reference = sincResample(samples, rate)
  let difference = 0
  let signal = 0
  for (let i = 0; i < reference.length; i += 1) {
    difference += (linear[i] - reference[i]) ** 2
    signal += reference[i] ** 2
  }
  return Math.sqrt(difference / signal)
}

/** |X(f)|^2 per bin of the whole sample, zero-padded to a power of two. */
function energyByBin(samples) {
  let n = 1
  while (n < samples.length) n <<= 1
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  re.set(samples)
  fft(re, im)
  const energy = new Float64Array(n / 2)
  for (let bin = 0; bin < n / 2; bin += 1) energy[bin] = re[bin] ** 2 + im[bin] ** 2
  return energy
}

/** Amplitude share of the spectrum above `hz`, as a ratio of the whole. */
function shareAbove(energy, hz) {
  const first = Math.ceil((hz / (SAMPLE_RATE / 2)) * energy.length)
  let above = 0
  let total = 0
  for (let bin = 0; bin < energy.length; bin += 1) {
    total += energy[bin]
    if (bin >= first) above += energy[bin]
  }
  return Math.sqrt(above / total)
}

/** In-place iterative radix-2 FFT. `re.length` is a power of two. */
function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const step = len >> 1
    const angle = (-2 * Math.PI) / len
    for (let start = 0; start < n; start += len) {
      for (let k = 0; k < step; k += 1) {
        const wr = Math.cos(angle * k)
        const wi = Math.sin(angle * k)
        const ar = re[start + k]
        const ai = im[start + k]
        const br = re[start + k + step] * wr - im[start + k + step] * wi
        const bi = re[start + k + step] * wi + im[start + k + step] * wr
        re[start + k] = ar + br
        im[start + k] = ai + bi
        re[start + k + step] = ar - br
        im[start + k + step] = ai - bi
      }
    }
  }
}
