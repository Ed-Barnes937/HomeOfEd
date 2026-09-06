import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSpeechAvailabilityTracker, speak, speechSupported } from './speak.ts'

/** Records the utterances handed to a stubbed Web Speech API. */
class FakeUtterance {
  lang = ''
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public text: string) {}
}

function installSpeech({ speaking = false, pending = false, paused = false } = {}) {
  const speakSpy = vi.fn()
  const cancelSpy = vi.fn()
  const resumeSpy = vi.fn()
  const win = {
    speechSynthesis: {
      speak: speakSpy,
      cancel: cancelSpy,
      resume: resumeSpy,
      speaking,
      pending,
      paused,
    },
    SpeechSynthesisUtterance: FakeUtterance,
  }
  vi.stubGlobal('window', win)
  return { speakSpy, cancelSpy, resumeSpy }
}

/**
 * Models the WebKit trap behind the old-Intel-Mac Safari bug: cancel() on an
 * idle queue silently drops the utterance queued in the same tick — no start,
 * no end, no error.
 */
class DroppingSynth {
  spokenTexts: string[] = []
  speaking = false
  pending = false
  paused = false
  private poisoned = false
  cancel() {
    if (!this.speaking && !this.pending) this.poisoned = true
  }
  resume() {}
  speak(utterance: FakeUtterance) {
    if (this.poisoned) {
      this.poisoned = false
      return
    }
    this.spokenTexts.push(utterance.text)
    utterance.onstart?.()
    utterance.onend?.()
  }
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

  it('leaves an idle queue alone — WebKit drops a same-tick speak after an idle cancel', () => {
    const { cancelSpy } = installSpeech()
    speak('brave')
    expect(cancelSpy).not.toHaveBeenCalled()
  })

  it('cancels an in-flight utterance before speaking', () => {
    const { speakSpy, cancelSpy } = installSpeech({ speaking: true })
    speak('curious')
    expect(cancelSpy).toHaveBeenCalledTimes(1)
    expect(cancelSpy.mock.invocationCallOrder[0]!).toBeLessThan(speakSpy.mock.invocationCallOrder[0]!)
  })

  it('cancels a pending utterance before speaking', () => {
    const { cancelSpy } = installSpeech({ pending: true })
    speak('curious')
    expect(cancelSpy).toHaveBeenCalledTimes(1)
  })

  it('resumes a wedged paused synthesizer before speaking', () => {
    const { speakSpy, resumeSpy } = installSpeech({ paused: true })
    speak('brave')
    expect(resumeSpy).toHaveBeenCalledTimes(1)
    expect(resumeSpy.mock.invocationCallOrder[0]!).toBeLessThan(speakSpy.mock.invocationCallOrder[0]!)
  })

  it('does not poke resume when the synthesizer is not paused', () => {
    const { resumeSpy } = installSpeech()
    speak('brave')
    expect(resumeSpy).not.toHaveBeenCalled()
  })

  it('plays on a WebKit that silently drops a same-tick speak after an idle cancel', () => {
    const synth = new DroppingSynth()
    vi.stubGlobal('window', { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance })
    const onStart = vi.fn()
    speak('brave', { onStart })
    expect(synth.spokenTexts).toEqual(['brave'])
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('does nothing when speech is unsupported', () => {
    vi.stubGlobal('window', {})
    expect(() => speak('brave')).not.toThrow()
  })

  it('reports playback start and end through the callbacks', () => {
    const { speakSpy } = installSpeech()
    const onStart = vi.fn()
    const onEnd = vi.fn()
    speak('brave', { onStart, onEnd })
    const utterance = speakSpy.mock.calls[0]![0] as FakeUtterance
    expect(onStart).not.toHaveBeenCalled()
    utterance.onstart!()
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
    utterance.onend!()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('reports a playback error as an end, so a playing state always clears', () => {
    const { speakSpy } = installSpeech()
    const onEnd = vi.fn()
    speak('brave', { onEnd })
    const utterance = speakSpy.mock.calls[0]![0] as FakeUtterance
    utterance.onerror!()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})

/** Stubs the API with a controllable voice list and voiceschanged events. */
function installVoices({ voices = [] as unknown[], hasGetVoices = true } = {}) {
  let voiceList = voices
  const changedListeners: Array<() => void> = []
  const synth: Record<string, unknown> = {
    speak: vi.fn(),
    cancel: vi.fn(),
    resume: vi.fn(),
    getVoices: () => voiceList,
    addEventListener: (_event: string, listener: () => void) => {
      changedListeners.push(listener)
    },
    removeEventListener: vi.fn(),
  }
  if (!hasGetVoices) delete synth.getVoices
  vi.stubGlobal('window', { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance })
  return {
    fireVoicesChanged: (next: unknown[]) => {
      voiceList = next
      for (const listener of [...changedListeners]) listener()
    },
  }
}

describe('speech availability', () => {
  it('is unavailable without the API', () => {
    vi.stubGlobal('window', {})
    expect(createSpeechAvailabilityTracker().isAvailable()).toBe(false)
  })

  it('is available immediately when voices are already listed', () => {
    installVoices({ voices: [{ name: 'Daniel' }] })
    expect(createSpeechAvailabilityTracker().isAvailable()).toBe(true)
  })

  it('starts unavailable while the voice list is still empty', () => {
    installVoices()
    expect(createSpeechAvailabilityTracker().isAvailable()).toBe(false)
  })

  it('becomes available and notifies subscribers when voices arrive late', () => {
    const { fireVoicesChanged } = installVoices()
    const tracker = createSpeechAvailabilityTracker()
    const listener = vi.fn()
    tracker.subscribe(listener)
    fireVoicesChanged([{ name: 'Daniel' }])
    expect(tracker.isAvailable()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stays unavailable when voiceschanged fires with a still-empty list', () => {
    const { fireVoicesChanged } = installVoices()
    const tracker = createSpeechAvailabilityTracker()
    const listener = vi.fn()
    tracker.subscribe(listener)
    fireVoicesChanged([])
    expect(tracker.isAvailable()).toBe(false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops notifying after unsubscribe', () => {
    const { fireVoicesChanged } = installVoices()
    const tracker = createSpeechAvailabilityTracker()
    const listener = vi.fn()
    const unsubscribe = tracker.subscribe(listener)
    unsubscribe()
    fireVoicesChanged([{ name: 'Daniel' }])
    expect(listener).not.toHaveBeenCalled()
  })

  it('treats an API without getVoices as available rather than hiding on a capable browser', () => {
    installVoices({ hasGetVoices: false })
    expect(createSpeechAvailabilityTracker().isAvailable()).toBe(true)
  })
})
