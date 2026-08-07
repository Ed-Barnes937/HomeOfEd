import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * Ticket 18's data-side check on the shipped launch kit's one-shots: short,
 * no long tails, and balanced so a dense six-row hit doesn't clip through
 * the existing gain staging (`ToneAudioDriver`'s MASTER_GAIN 0.6 +
 * Limiter(-1), tuned against a ~1.83 raw combined-peak budget — see its
 * comment). Kit data only: no engine code depends on this file.
 */

const SAMPLE_RATE = 44100
const STEP_SECONDS = 60 / 200 / 4 // one 16th note at 200 BPM

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

describe('launch kit one-shot levels', () => {
  const soundsDir = fileURLToPath(new URL('../../public/kits/launch/sounds/', import.meta.url))
  const instrumentIds = ['kick', 'snare', 'hat', 'tom', 'marimba', 'boop']

  it('each one-shot is short with no long tail (< 400ms)', async () => {
    for (const id of instrumentIds) {
      const samples = readWav(await readFile(`${soundsDir}${id}.wav`))
      const durationMs = (samples.length / SAMPLE_RATE) * 1000
      expect(durationMs, `${id}.wav duration`).toBeLessThan(400)
    }
  })

  it('a dense six-row hit does not exceed the gain-staging budget the engine was tuned against', async () => {
    const tracks = await Promise.all(
      instrumentIds.map(async (id) => readWav(await readFile(`${soundsDir}${id}.wav`))),
    )
    const maxLength = Math.max(...tracks.map((t) => t.length))
    const sum = new Float32Array(maxLength)
    for (const track of tracks) {
      for (let i = 0; i < track.length; i += 1) sum[i] = (sum[i] ?? 0) + (track[i] ?? 0)
    }
    // ToneAudioDriver's MASTER_GAIN/Limiter comment: "six ... one-shots
    // landing on the same step sum to ~1.83 raw"; stay at or below that.
    expect(peakOf(sum)).toBeLessThanOrEqual(1.83 + 0.05)
  })

  it('retriggering at 200bpm 16th notes does not build up level (a real one-shot, not a drone)', async () => {
    const hitsPerTrain = 8
    const stepSamples = Math.round(STEP_SECONDS * SAMPLE_RATE)
    for (const id of instrumentIds) {
      const samples = readWav(await readFile(`${soundsDir}${id}.wav`))
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
      // a sustained/looping sample would build far past this.
      expect(trainPeak / singlePeak, `${id} retrigger buildup`).toBeLessThan(1.4)
    }
  })
})
