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

/** The captured fragment while the address bar holds the same one (perhaps router-decoded) on the same
 *  path; the live fragment after a hash-only navigation; `''` once cleared or on another path. */
export function liveArrivalFragment(captured: PageAddress | null, current: PageAddress): string {
  if (captured === null || current.hash === '' || current.pathname !== captured.pathname) return ''
  return decoded(captured.hash) === decoded(current.hash) ? captured.hash : current.hash
}

function decoded(fragment: string): string {
  try {
    return decodeURIComponent(fragment)
  } catch {
    return fragment
  }
}
