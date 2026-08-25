/**
 * A hand-rolled WAV encoder — mono, 16-bit PCM, the smallest format the
 * export needs. Pure and byte-testable: no AudioContext or Blob here, just
 * `Float32Array` in, `ArrayBuffer` out.
 */

const HEADER_BYTES = 44
const BITS_PER_SAMPLE = 16
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8
const CHANNELS = 1

/** Encode mono samples in [-1, 1] (values outside that range are clamped) as a WAV file. */
export function encodeWavPcm16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataBytes = samples.length * BYTES_PER_SAMPLE
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(view, 8, 'WAVE')

  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, CHANNELS, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * CHANNELS * BYTES_PER_SAMPLE, true) // byte rate
  view.setUint16(32, CHANNELS * BYTES_PER_SAMPLE, true) // block align
  view.setUint16(34, BITS_PER_SAMPLE, true)

  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!))
    const pcm = clamped < 0 ? clamped * 32768 : clamped * 32767
    view.setInt16(HEADER_BYTES + i * BYTES_PER_SAMPLE, Math.round(pcm), true)
  }

  return buffer
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
}
