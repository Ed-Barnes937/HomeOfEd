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
  const utterance = new window.SpeechSynthesisUtterance(word)
  utterance.lang = 'en-GB'
  if (onStart) utterance.onstart = () => onStart()
  if (onEnd) {
    utterance.onend = () => onEnd()
    utterance.onerror = () => onEnd()
  }
  window.speechSynthesis.cancel() // interrupt any in-flight utterance
  window.speechSynthesis.speak(utterance)
}
