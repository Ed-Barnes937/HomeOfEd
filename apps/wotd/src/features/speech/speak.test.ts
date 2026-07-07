import { afterEach, describe, expect, it, vi } from 'vitest'

import { speak, speechSupported } from './speak.ts'

/** Records the utterances handed to a stubbed Web Speech API. */
class FakeUtterance {
  lang = ''
  constructor(public text: string) {}
}

function installSpeech() {
  const speakSpy = vi.fn()
  const cancelSpy = vi.fn()
  const win = {
    speechSynthesis: { speak: speakSpy, cancel: cancelSpy },
    SpeechSynthesisUtterance: FakeUtterance,
  }
  vi.stubGlobal('window', win)
  return { speakSpy, cancelSpy }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('speechSupported', () => {
  it('is false when there is no speechSynthesis on window', () => {
    vi.stubGlobal('window', {})
    expect(speechSupported()).toBe(false)
  })

  it('is true when speechSynthesis exists', () => {
    installSpeech()
    expect(speechSupported()).toBe(true)
  })
})

describe('speak', () => {
  it('speaks the word with the en-GB voice', () => {
    const { speakSpy } = installSpeech()
    speak('brave')
    expect(speakSpy).toHaveBeenCalledTimes(1)
    const utterance = speakSpy.mock.calls[0]![0] as FakeUtterance
    expect(utterance.text).toBe('brave')
    expect(utterance.lang).toBe('en-GB')
  })

  it('cancels any in-flight utterance before speaking', () => {
    const { speakSpy, cancelSpy } = installSpeech()
    speak('curious')
    expect(cancelSpy).toHaveBeenCalledTimes(1)
    expect(cancelSpy.mock.invocationCallOrder[0]!).toBeLessThan(speakSpy.mock.invocationCallOrder[0]!)
  })

  it('does nothing when speech is unsupported', () => {
    vi.stubGlobal('window', {})
    expect(() => speak('brave')).not.toThrow()
  })
})
