import { describe, expect, it } from 'vitest'

import { webAudioSampleDecoder } from './sampleDecoder.ts'

/** A fake `BaseAudioContext`, just enough of it for the decoder's orchestration. */
function fakeContext(channelData: Float32Array) {
  const decoded: ArrayBuffer[] = []
  return {
    decoded,
    context: {
      decodeAudioData: (arrayBuffer: ArrayBuffer) => {
        decoded.push(arrayBuffer)
        return Promise.resolve({ getChannelData: () => channelData } as unknown as AudioBuffer)
      },
    } as unknown as BaseAudioContext,
  }
}

describe('webAudioSampleDecoder', () => {
  it('fetches the url, decodes the body, and returns a copy of channel 0', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer
    const fetchImpl = (input: string) => {
      expect(input).toBe('/kits/launch/sounds/kick.wav')
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(bytes) } as Response)
    }
    const channelData = new Float32Array([0.1, 0.2])
    const { context, decoded } = fakeContext(channelData)

    const decode = webAudioSampleDecoder(context, fetchImpl)
    const result = await decode('/kits/launch/sounds/kick.wav')

    expect(decoded).toEqual([bytes])
    expect(result).toEqual(channelData)
    expect(result).not.toBe(channelData) // a copy, not the AudioBuffer's own backing array
  })

  it('throws on a non-ok response rather than decoding garbage', async () => {
    const fetchImpl = () => Promise.resolve({ ok: false, status: 404 } as Response)
    const { context } = fakeContext(new Float32Array())

    await expect(webAudioSampleDecoder(context, fetchImpl)('/missing.wav')).rejects.toThrow('404')
  })
})
