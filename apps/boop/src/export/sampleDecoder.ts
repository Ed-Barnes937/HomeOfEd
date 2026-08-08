/**
 * Fetches and decodes one sample's mono PCM data. The seam `renderBoopWav`
 * schedules against — injected so the render orchestration is testable
 * without a real (Offline)AudioContext.
 */
export type SampleDecoder = (url: string) => Promise<Float32Array>

type Fetch = (input: string) => Promise<Response>

/**
 * The production decoder: `fetch` + `decodeAudioData` against whatever
 * `BaseAudioContext` is handed in (an `OfflineAudioContext` at the export's
 * target sample rate, so every sample is decoded at the same rate the render
 * mixes at). Only the first channel is kept — the kit's one-shots are mono.
 */
export function webAudioSampleDecoder(
  context: BaseAudioContext,
  fetchImpl: Fetch = globalThis.fetch,
): SampleDecoder {
  return async (url) => {
    const response = await fetchImpl(url)
    if (!response.ok) {
      throw new Error(`sample ${url} could not be loaded (HTTP ${response.status})`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await context.decodeAudioData(arrayBuffer)
    // Copy out of the AudioBuffer so the caller doesn't hold a reference into it.
    return audioBuffer.getChannelData(0).slice()
  }
}
