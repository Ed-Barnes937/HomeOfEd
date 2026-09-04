/** The one place the app names the OS "less motion" setting. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * True when the device is asking for less motion, as of this call. It sets the
 * flock's *initial* run state rather than vetoing motion outright - pressing
 * play is consent (ADR 0044).
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}
