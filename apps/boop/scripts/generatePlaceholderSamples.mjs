/**
 * Generates the six placeholder one-shots for the launch kit
 * (`public/kits/launch/sounds/*.wav`). They are synthesized here rather than
 * sourced so the repo carries no third-party audio: ticket 18 replaces them
 * with the real CC0 kit.
 *
 *   node apps/boop/scripts/generatePlaceholderSamples.mjs
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
 */
const voices = {
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
}

const outDir = fileURLToPath(new URL('../public/kits/launch/sounds/', import.meta.url))
mkdirSync(outDir, { recursive: true })
for (const [id, render] of Object.entries(voices)) {
  const samples = declick(normalise(render()))
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

function noise({ seconds, decay }) {
  const length = Math.round(seconds * SAMPLE_RATE)
  const out = new Float32Array(length)
  let seed = 1
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
  return samples.map((s) => s * factor)
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
