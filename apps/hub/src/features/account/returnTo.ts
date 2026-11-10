// The way back to the estate app that sent a visitor here (ADR 0095).
import {
  type FamilyTokenClaims,
  readFamilySession,
  type SafeReturnToOpts,
  safeReturnTo,
  sharedUrl,
} from '@hoe/accounts'

import { returnToOptions } from './familyService.ts'

// Captured at module load, before the router rewrites the address bar on mount.
const arrival =
  typeof window === 'undefined'
    ? null
    : {
        pathname: window.location.pathname,
        search: window.location.search,
        fragment: window.location.hash,
      }

/**
 * The single `returnTo` in `search`, as `safeReturnTo` vets it, with the
 * fragment appended after a `#` so that whatever it holds it parses as fragment.
 */
export function returnDestination(
  search: string,
  fragment: string,
  opts: SafeReturnToOpts,
): string | null {
  const vetted = safeReturnTo(singleReturnTo(search), opts)
  if (vetted === null) return null
  const text = fragment.startsWith('#') ? fragment.slice(1) : fragment
  return text === '' ? vetted : `${vetted}#${text}`
}

/** "Open what was shared": the app's ungated `/shared` view, when a fragment came along. */
export function sharedLink(): string | null {
  const visit = currentArrival()
  if (visit === null || visit.fragment === '') return null
  return sharedUrl(singleReturnTo(visit.search) ?? '', visit.fragment, visit.opts)
}

/**
 * Sends the visitor back, but only once the cookie `written` describes reads
 * back from the browser, since an app without it would send them straight here.
 */
export function returnToApp(written: FamilyTokenClaims | null): boolean {
  if (written === null || readFamilySession()?.sub !== written.sub) return false
  const visit = currentArrival()
  if (visit === null) return false
  const destination = returnDestination(visit.search, visit.fragment, visit.opts)
  if (destination === null) return false
  window.location.replace(destination)
  return true
}

function singleReturnTo(search: string): string | null {
  const values = new URLSearchParams(search).getAll('returnTo')
  return values.length === 1 ? values[0]! : null
}

// Honoured only while the address bar is still on the page the visitor arrived at.
function currentArrival(): (NonNullable<typeof arrival> & { opts: SafeReturnToOpts }) | null {
  if (arrival === null || window.location.pathname !== arrival.pathname) return null
  if (!new URLSearchParams(window.location.search).has('returnTo')) return null
  return { ...arrival, opts: returnToOptions(window.location.hostname) }
}
