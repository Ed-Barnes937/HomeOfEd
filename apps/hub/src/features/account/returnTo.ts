/**
 * The way back to the estate app that sent a visitor here (ADR 0095). The gate
 * sends `/account?returnTo=<url>`, and the browser carries the original fragment
 * onto hub's own URL. Both are read from the address bar each time they are
 * needed, so nothing outlives this visit and nothing stored is ever trusted.
 */
import { type SafeReturnToOpts, safeReturnTo, sharedUrl } from '@hoe/accounts'
import { useLocation } from '@tanstack/react-router'

import { returnToOptions } from './familyService.ts'

export interface ReturnTo {
  /** The app's ungated `/shared` view, offered only when a fragment came along. */
  sharedLink: string | null
  /** Navigates back if `returnTo` still passes `safeReturnTo`; false when it did not. */
  returnToApp: () => boolean
}

/**
 * `returnTo` as `safeReturnTo` vets it, with the carried fragment appended
 * after a `#`, so whatever the fragment holds it parses as fragment.
 */
export function returnDestination(
  returnTo: string | null,
  fragment: string,
  opts: SafeReturnToOpts,
): string | null {
  const vetted = safeReturnTo(returnTo, opts)
  if (vetted === null) return null
  const text = fragment.startsWith('#') ? fragment.slice(1) : fragment
  return text === '' ? vetted : `${vetted}#${text}`
}

export function useReturnTo(): ReturnTo {
  // Subscribes to the router so a client-side move re-renders; the values come
  // from window.location, unparsed, because the router JSON-parses search values.
  useLocation()
  const { returnTo, fragment, opts } = fromAddressBar()
  return {
    sharedLink: fragment === '' ? null : sharedUrl(returnTo ?? '', fragment, opts),
    returnToApp,
  }
}

function returnToApp(): boolean {
  const { returnTo, fragment, opts } = fromAddressBar()
  const destination = returnDestination(returnTo, fragment, opts)
  if (destination === null) return false
  window.location.replace(destination)
  return true
}

function fromAddressBar(): { returnTo: string | null; fragment: string; opts: SafeReturnToOpts } {
  return {
    returnTo: new URLSearchParams(window.location.search).get('returnTo'),
    fragment: window.location.hash,
    opts: returnToOptions(window.location.hostname),
  }
}
