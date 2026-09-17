/**
 * Measures the pitch of the launch kit's one-shots
 * (`public/kits/launch/sounds/*.wav`).
 *
 *   node apps/boop/scripts/measureSamplePitch.mjs              # the whole kit
 *   node apps/boop/scripts/measureSamplePitch.mjs marimba boop # named voices
 *
 * A converted instrument's anchor **is** its shipped sample's pitch (pitched-lane
 * spec §3), so what this prints is the fact a `pitched` register has to agree
 * with - see ADR 0058's family and `.scratch/pitched-instruments/`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'

const SAMPLE_RATE = 44100
const FRAME = 2048
const HOP = 256
/** Below this a frame is tail, not tone: it would drag a glide's average down. */
const SILENCE_RMS = 0.005

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const soundsDir = fileURLToPath(new URL('../public/kits/launch/sounds/', import.meta.url))
const requested = process.argv.slice(2)
const ids =
  requested.length > 0
    ? requested
    : readdirSync(soundsDir)
        .filter((file) => file.endsWith('.wav'))
        .map((file) => file.slice(0, -4))

for (const id of ids) {
  const samples = readWav(readFileSync(`${soundsDir}${id}.wav`))
  const frames = analyse(samples)
  if (frames.length === 0) {
    process.stdout.write(`${id.padEnd(10)} no pitch found (unpitched or too quiet)\n`)
    continue
  }
  const onset = frames[0].hz
  const centre = energyWeightedHz(frames)
  const drift = Math.abs(midiOf(frames.at(-1).hz) - midiOf(onset))
  const glide = drift > 0.5 ? `  glides ${drift.toFixed(1)}st` : ''
  process.stdout.write(
    `${id.padEnd(10)} ${describe(centre).padEnd(22)} centre ${centre.toFixed(1).padStart(7)} Hz` +
      `  onset ${describe(onset)}${glide}\n`,
  )
}

function analyse(samples) {
  const frames = []
  for (let start = 0; start + FRAME <= samples.length; start += HOP) {
    const frame = samples.subarray(start, start + FRAME)
    const rms = Math.sqrt(frame.reduce((a, s) => a + s * s, 0) / FRAME)
    if (rms < SILENCE_RMS) continue
    const hz = fundamentalOf(frame)
    if (hz !== null) frames.push({ hz, rms })
  }
  return frames
}

/** Averaged in semitones, not Hz, and weighted by level: what the ear lands on. */
function energyWeightedHz(frames) {
  const energy = frames.reduce((a, f) => a + f.rms, 0)
  const midi = frames.reduce((a, f) => a + midiOf(f.hz) * f.rms, 0) / energy
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Normalised autocorrelation, parabolically interpolated around its best peak. */
function fundamentalOf(frame) {
  const mean = frame.reduce((a, s) => a + s, 0) / frame.length
  const x = Float32Array.from(frame, (s) => s - mean)
  const energy = x.reduce((a, s) => a + s * s, 0)
  if (energy === 0) return null

  const minLag = Math.floor(SAMPLE_RATE / 4000)
  const maxLag = Math.min(Math.floor(SAMPLE_RATE / 60), Math.floor(frame.length / 2))
  const r = new Float32Array(maxLag + 2)
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0
    let lagged = 0
    for (let i = 0; i + lag < x.length; i += 1) {
      sum += x[i] * x[i + lag]
      lagged += x[i + lag] * x[i + lag]
    }
    r[lag] = sum / (Math.sqrt(energy * lagged) || 1)
  }

  let bestLag = 0
  let best = 0.3 // anything weaker is not a tone
  for (let lag = minLag + 1; lag < maxLag; lag += 1) {
    if (r[lag] > r[lag - 1] && r[lag] >= r[lag + 1] && r[lag] > best) {
      best = r[lag]
      bestLag = lag
    }
  }
  if (bestLag === 0) return null

  const [y0, y1, y2] = [r[bestLag - 1], r[bestLag], r[bestLag + 1]]
  const offset = (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2 || 1e-12)
  return SAMPLE_RATE / (bestLag + offset)
}

function midiOf(hz) {
  return 69 + 12 * Math.log2(hz / 440)
}

function describe(hz) {
  const midi = midiOf(hz)
  const nearest = Math.round(midi)
  const cents = Math.round((midi - nearest) * 100)
  const name = `${NOTE_NAMES[((nearest % 12) + 12) % 12]}${Math.floor(nearest / 12) - 1}`
  return `${name} ${cents >= 0 ? '+' : ''}${cents}c`
}

function readWav(buffer) {
  const dataIndex = buffer.indexOf('data')
  const dataLength = buffer.readUInt32LE(dataIndex + 4)
  const dataOffset = dataIndex + 8
  const out = new Float32Array(dataLength / 2)
  for (let i = 0; i < out.length; i += 1) out[i] = buffer.readInt16LE(dataOffset + i * 2) / 32767
  return out
}
