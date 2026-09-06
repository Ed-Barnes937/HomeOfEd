import { useSyncExternalStore } from 'react'

import { getSpeechAvailabilityTracker } from './speak.ts'

/**
 * Whether this browser can genuinely speak (API present and voices resolved).
 * Starts false and flips true at most once when the async voice list settles,
 * so a control gated on it never flashes in and out.
 */
export function useSpeechAvailable(): boolean {
  const tracker = getSpeechAvailabilityTracker()
  return useSyncExternalStore(tracker.subscribe, tracker.isAvailable)
}
