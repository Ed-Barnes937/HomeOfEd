/** 16-bit mono PCM WAV - the one format the kit's scripts read and write. */
import { Buffer } from 'node:buffer'

export const SAMPLE_RATE = 44100

export function readWav(buffer) {
  const dataIndex = buffer.indexOf('data')
  const dataLength = buffer.readUInt32LE(dataIndex + 4)
  const out = new Float32Array(dataLength / 2)
  for (let i = 0; i < out.length; i += 1) out[i] = buffer.readInt16LE(dataIndex + 8 + i * 2) / 32767
  return out
}

/** The most universally decodable thing a browser can be handed. */
export function wav(samples) {
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
