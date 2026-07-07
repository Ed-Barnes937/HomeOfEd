// Native browser text-to-speech via the Web Speech API. Client-only — no
// backend, no audio files. Voices come from the user's OS, so quality varies
// by device; see the WOTDCard button for the graceful-degradation guard.

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(word: string): void {
  if (!speechSupported()) return
  const utterance = new window.SpeechSynthesisUtterance(word)
  utterance.lang = 'en-GB'
  window.speechSynthesis.cancel() // interrupt any in-flight utterance
  window.speechSynthesis.speak(utterance)
}
