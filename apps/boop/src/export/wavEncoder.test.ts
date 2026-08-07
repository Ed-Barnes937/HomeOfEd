import { describe, expect, it } from 'vitest'

import { encodeWavPcm16 } from './wavEncoder.ts'

/** Read a little-endian value back out of the encoded buffer for assertions. */
function view(buffer: ArrayBuffer): DataView {
  return new DataView(buffer)
}

describe('encodeWavPcm16', () => {
  it('writes a canonical 44-byte RIFF/WAVE/fmt/data header for mono 16-bit PCM', () => {
    const buffer = encodeWavPcm16(new Float32Array([0, 0]), 8000)
    const dv = view(buffer)

    expect(String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3))).toBe(
      'RIFF',
    )
    expect(dv.getUint32(4, true)).toBe(buffer.byteLength - 8) // RIFF chunk size
    expect(String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11))).toBe(
      'WAVE',
    )
    expect(String.fromCharCode(dv.getUint8(12), dv.getUint8(13), dv.getUint8(14), dv.getUint8(15))).toBe(
      'fmt ',
    )
    expect(dv.getUint32(16, true)).toBe(16) // fmt chunk size
    expect(dv.getUint16(20, true)).toBe(1) // PCM
    expect(dv.getUint16(22, true)).toBe(1) // mono
    expect(dv.getUint32(24, true)).toBe(8000) // sample rate
    expect(dv.getUint32(28, true)).toBe(8000 * 2) // byte rate (16-bit mono)
    expect(dv.getUint16(32, true)).toBe(2) // block align
    expect(dv.getUint16(34, true)).toBe(16) // bits per sample
    expect(String.fromCharCode(dv.getUint8(36), dv.getUint8(37), dv.getUint8(38), dv.getUint8(39))).toBe(
      'data',
    )
    expect(dv.getUint32(40, true)).toBe(4) // data chunk size: 2 samples * 2 bytes
    expect(buffer.byteLength).toBe(44 + 4)
  })

  it('converts full-scale samples to the 16-bit PCM extremes', () => {
    const buffer = encodeWavPcm16(new Float32Array([1, -1, 0, 0.5, -0.5]), 44100)
    const dv = view(buffer)
    const at = (i: number) => dv.getInt16(44 + i * 2, true)

    expect(at(0)).toBe(32767)
    expect(at(1)).toBe(-32768)
    expect(at(2)).toBe(0)
    expect(at(3)).toBe(16384) // round(0.5 * 32767)
    expect(at(4)).toBe(-16384)
  })

  it('clamps out-of-range samples rather than wrapping', () => {
    const buffer = encodeWavPcm16(new Float32Array([2, -2]), 44100)
    const dv = view(buffer)

    expect(dv.getInt16(44, true)).toBe(32767)
    expect(dv.getInt16(46, true)).toBe(-32768)
  })

  it('encodes silence (empty input) as a header with a zero-length data chunk', () => {
    const buffer = encodeWavPcm16(new Float32Array(0), 44100)
    expect(buffer.byteLength).toBe(44)
    expect(view(buffer).getUint32(40, true)).toBe(0)
  })
})
