import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseKitManifest } from './kitManifest.ts'

/**
 * Ticket 18's data-side check on the shipped launch kit's one-shots, extended
 * to the whole 20-instrument roster (instruments ticket 01): short, level-
 * capped, and no build-up when retriggered at the top of the tempo range.
 *
 * The ids come from the manifest, never a list in here - kits are pure data
 * and nothing outside `kit.json` may enumerate instrument ids.
 *
 * Kit data only: no engine code depends on this file.
 */

const SAMPLE_RATE = 44100
const STEP_SECONDS = 60 / 200 / 4 // one 16th note at 200 BPM
/** Per-voice ceiling the generator normalises to, plus 16-bit rounding slack. */
const VOICE_PEAK = 0.5 + 0.001

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

  it('a dense hit of the classic six still sums to the budget the engine was tuned against', async () => {
    const classicSix = ['kick', 'snare', 'hat', 'tom', 'marimba', 'boop']
    const voices = await roster()
    const tracks = classicSix.map((id) => {
      const voice = voices.find((v) => v.id === id)
      if (!voice) throw new Error(`the manifest no longer carries ${id}`)
      return voice.samples
    })
    // ToneAudioDriver's MASTER_GAIN/Limiter comment: "six ... one-shots
    // landing on the same step sum to ~1.83 raw"; stay at or below that.
    expect(peakOf(sumOf(tracks))).toBeLessThanOrEqual(1.83 + 0.05)
  })

  it('a dense hit of the whole roster stays at the level ticket 08 will size the budget from', async () => {
    const voices = await roster()
    // The six-row sum above is no longer the worst case: a clip may hold all
    // 20 rows, and layered clips sound their union. Measured today: 2.97 raw
    // (well under the 8.95 the per-voice peaks would give if they all peaked
    // in phase, which they don't). This pins that figure so no new or
    // re-tuned voice can inflate it unnoticed. **Ticket 08 owns the gain
    // decision** - it re-measures this union (including the same instrument
    // sounding from two layered clips), states the final budget, and retunes
    // MASTER_GAIN against it. Raising this number is that ticket's call, not
    // a way to quiet a red test.
    expect(peakOf(sumOf(voices.map((v) => v.samples)))).toBeLessThanOrEqual(3.1)
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
