// Native browser text-to-speech via the Web Speech API. Client-only — no
// backend, no audio files. Voices come from the user's OS, so quality varies
// by device; see the word page's "Hear it" button for the graceful-degradation guard.

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export type SpeakCallbacks = {
  onStart?: () => void
  /** Fires on normal completion AND on error, so a playing state always clears. */
  onEnd?: () => void
}

export function speak(word: string, { onStart, onEnd }: SpeakCallbacks = {}): void {
  if (!speechSupported()) return
  const synth = window.speechSynthesis
  const utterance = new window.SpeechSynthesisUtterance(word)
  utterance.lang = 'en-GB'
  if (onStart) utterance.onstart = () => onStart()
  if (onEnd) {
    utterance.onend = () => onEnd()
    utterance.onerror = () => onEnd()
  }
  // WebKit silently drops an utterance queued in the same tick as a cancel()
  // on an idle queue (the old-Intel-Mac Safari bug), so only interrupt when
  // something is actually in flight. speak() must stay synchronous here:
  // Safari ties playback to the user-gesture context, so deferring it a tick
  // would go silent instead.
  if (synth.speaking || synth.pending) synth.cancel()
  // WebKit can wedge with paused=true after an interrupted utterance, after
  // which new utterances queue forever; resume() unblocks it.
  if (synth.paused) synth.resume()
  synth.speak(utterance)
}

export type SpeechAvailability = {
  isAvailable: () => boolean
  subscribe: (listener: () => void) => () => void
}

/**
 * Whether this browser can genuinely speak: the API exists AND the voice list
 * is (or becomes) non-empty. Voice lists load asynchronously — empty until a
 * `voiceschanged` — so availability starts pessimistic and flips to available
 * at most once; a genuinely voiceless browser simply never flips.
 */
export function createSpeechAvailabilityTracker(): SpeechAvailability {
  const listeners = new Set<() => void>()
  const synth = speechSupported() ? window.speechSynthesis : null
  // An API without getVoices can't be assessed — showing the control on a
  // capable browser beats hiding it, so assume available.
  let available = synth !== null && typeof synth.getVoices !== 'function'

  if (synth && !available) {
    const check = () => {
      if (synth.getVoices().length === 0) return
      available = true
      synth.removeEventListener?.('voiceschanged', check)
      for (const listener of [...listeners]) listener()
    }
    available = synth.getVoices().length > 0
    if (!available) synth.addEventListener?.('voiceschanged', check)
  }

  return {
    isAvailable: () => available,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

let defaultTracker: SpeechAvailability | undefined

/** The page-wide tracker instance backing the `useSpeechAvailable` hook. */
export function getSpeechAvailabilityTracker(): SpeechAvailability {
  return (defaultTracker ??= createSpeechAvailabilityTracker())
}
