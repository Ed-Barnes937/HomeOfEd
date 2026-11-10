interface PageAddress {
  pathname: string
  hash: string
}

function currentAddress(): PageAddress | null {
  const location = (globalThis as { location?: PageAddress }).location
  return location === undefined ? null : { pathname: location.pathname, hash: location.hash }
}

// Captured when this module loads, which is before an app's router mounts and decodes the address bar.
const arrival = currentAddress()

/** The fragment this page was opened with, byte for byte, or `''` once it has been cleared. */
export function arrivalFragment(): string {
  const current = currentAddress()
  return current === null ? '' : liveArrivalFragment(arrival, current)
}

/**
 * The captured fragment while the address bar still carries one on the same
 * path, so a later mount after the fragment was cleared does not replay it.
 */
export function liveArrivalFragment(captured: PageAddress | null, current: PageAddress): string {
  if (captured === null || current.hash === '' || current.pathname !== captured.pathname) return ''
  return captured.hash
}
