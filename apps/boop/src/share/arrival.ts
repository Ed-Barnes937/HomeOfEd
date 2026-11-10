// Captured at module load, before the router decodes the address bar's fragment on mount (ADR 0095).
const arrival =
  typeof window === 'undefined'
    ? null
    : { pathname: window.location.pathname, hash: window.location.hash }

interface PageAddress {
  pathname: string
  hash: string
}

/** The fragment this page was opened with, byte for byte, or `''` once it has been cleared. */
export function arrivalFragment(): string {
  return liveArrivalFragment(arrival, window.location)
}

/**
 * The captured fragment while the address bar still carries one on the same
 * path; a later mount after the fragment was cleared must not replay it.
 */
export function liveArrivalFragment(captured: PageAddress | null, current: PageAddress): string {
  if (captured === null || current.hash === '' || current.pathname !== captured.pathname) return ''
  return captured.hash
}
