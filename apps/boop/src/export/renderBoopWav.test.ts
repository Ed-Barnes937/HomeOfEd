import { describe, expect, it } from 'vitest'

import type { Kit, Pattern } from '../engine/sequencerEngine.ts'
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

const pattern: Pattern = [rowOf('kick', 0), rowOf('snare', 4)]

describe('renderBoopWav', () => {
  it('decodes every kit instrument by its sound url, renders, and encodes a WAV blob', async () => {
    const requested: string[] = []
    const decode = (url: string) => {
      requested.push(url)
      return Promise.resolve(new Float32Array([1]))
    }

    const blob = await renderBoopWav({ kit, pattern, bpm: 120, loops: 4, sampleRate: 8000, decode })

    expect(requested.sort()).toEqual(['/kits/launch/sounds/kick.wav', '/kits/launch/sounds/snare.wav'])
    expect(blob.type).toBe('audio/wav')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
  })

  it('defaults to 4 loops and 44100 Hz — the engine and kit sample rate', async () => {
    const decode = () => Promise.resolve(new Float32Array(0))
    const blob = await renderBoopWav({ kit, pattern, bpm: 100, decode })
    const dv = new DataView(await blob.arrayBuffer())

    expect(dv.getUint32(24, true)).toBe(44100)
    // 4 loops * 16 steps * secondsPerStep(0.15s at 100bpm) * 44100 samples/s = 4233600 samples.
    expect(dv.getUint32(40, true) / 2).toBe(4 * 16 * (60 / 100 / 4) * 44100)
  })
})
