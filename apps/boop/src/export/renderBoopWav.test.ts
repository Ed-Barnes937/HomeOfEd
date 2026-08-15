import { describe, expect, it } from 'vitest'

import type { Kit, Pattern } from '../engine/sequencerEngine.ts'
import type { Song } from '../song/song.ts'
import { renderBoopWav } from './renderBoopWav.ts'

const kit: Kit = {
  kitId: 'test',
  name: 'Test kit',
  instruments: [
    { instrumentId: 'kick', name: 'Kick', artwork: '', sound: '/kits/launch/sounds/kick.wav' },
    { instrumentId: 'snare', name: 'Snare', artwork: '', sound: '/kits/launch/sounds/snare.wav' },
  ],
}

function rowOf(instrumentId: string, ...onSteps: number[]) {
  const steps = new Array<boolean>(16).fill(false)
  for (const step of onSteps) steps[step] = true
  return { instrumentId, steps }
}

const kickPattern: Pattern = [rowOf('kick', 0), rowOf('snare')]
const snarePattern: Pattern = [rowOf('kick'), rowOf('snare', 0)]

function songOf(placements: readonly (readonly number[])[]): Song {
  return {
    bpm: 100,
    clips: [
      { name: 'Clip 1', tint: 0, pattern: kickPattern },
      { name: 'Clip 2', tint: 1, pattern: snarePattern },
    ],
    activeClipIndex: 0,
    placements,
  }
}

const EMPTY: readonly (readonly number[])[] = Array.from({ length: 16 }, () => [])

/** kick decodes positive, snare negative — one sample tells the clips apart. */
const signedDecode = (url: string) =>
  Promise.resolve(new Float32Array([url.includes('kick') ? 1 : -1]))

describe('renderBoopWav', () => {
  it('decodes every kit instrument by its sound url, renders, and encodes a WAV blob', async () => {
    const requested: string[] = []
    const decode = (url: string) => {
      requested.push(url)
      return Promise.resolve(new Float32Array([1]))
    }

    const blob = await renderBoopWav({ kit, song: songOf(EMPTY), sampleRate: 8000, decode })

    expect(requested.sort()).toEqual(['/kits/launch/sounds/kick.wav', '/kits/launch/sounds/snare.wav'])
    expect(blob.type).toBe('audio/wav')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
  })

  it('a song with no placements exports the grid clip 4 bars long at 44100 Hz — unchanged for an old boop', async () => {
    const decode = () => Promise.resolve(new Float32Array(0))
    const blob = await renderBoopWav({ kit, song: songOf(EMPTY), decode })
    const dv = new DataView(await blob.arrayBuffer())

    expect(dv.getUint32(24, true)).toBe(44100)
    // 4 loops * 16 steps * secondsPerStep(0.15s at 100bpm) * 44100 samples/s = 4233600 samples.
    expect(dv.getUint32(40, true) / 2).toBe(4 * 16 * (60 / 100 / 4) * 44100)
  })

  it('a song with no placements renders the grid clip, not clip 1', async () => {
    const song: Song = { ...songOf(EMPTY), activeClipIndex: 1 }
    const blob = await renderBoopWav({ kit, song, sampleRate: 4, decode: signedDecode })
    const dv = new DataView(await blob.arrayBuffer())

    expect(dv.getInt16(44, true)).toBeLessThan(0)
  })

  it('a song with placements exports one pass, left to right, empty positions skipped', async () => {
    // Positions: [1, empty, 0, empty...] -> pass is [snarePattern, kickPattern].
    const placements = [[1], [], [0], ...EMPTY.slice(3)]
    const blob = await renderBoopWav({
      kit,
      song: songOf(placements),
      sampleRate: 4,
      decode: signedDecode,
    })
    const dv = new DataView(await blob.arrayBuffer())

    const samplesPerStep = Math.round((60 / 100 / 4) * 4) // = 1
    const dataSamples = dv.getUint32(40, true) / 2
    // 2 placed positions * 16 steps * 1 sample/step, plus the 1-sample tail.
    expect(dataSamples).toBe(2 * 16 * samplesPerStep + 1)

    // PCM data starts at byte 44. First pass starts with the snare's negative
    // sample, the second with the kick's positive one — order is left to right.
    const first = dv.getInt16(44, true)
    const second = dv.getInt16(44 + 16 * samplesPerStep * 2, true)
    expect(first).toBeLessThan(0)
    expect(second).toBeGreaterThan(0)
  })

  it('exports a layered position as one slot with every clip in it sounding', async () => {
    // One position holding both clips: the kick's +1 and the snare's -1 land on
    // the same sample and cancel — proof both were mixed into the one slot.
    const blob = await renderBoopWav({
      kit,
      song: songOf([[0, 1], ...EMPTY.slice(1)]),
      sampleRate: 4,
      decode: signedDecode,
    })
    const dv = new DataView(await blob.arrayBuffer())

    // Still one slot long — layering stacks clips, it does not lengthen the song.
    expect(dv.getUint32(40, true) / 2).toBe(16 * 1 + 1)
    expect(dv.getInt16(44, true)).toBe(0)
  })
})
