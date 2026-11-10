import { ESTATE_APPS, HUB_LOCAL_PORTS } from './estateApps.ts'

export interface SafeReturnToOpts {
  /** True only when hub itself is served from localhost. */
  allowLocal: boolean
}

/**
 * Hub's account page with `returnTo` set. A fragment on `returnTo` moves onto the
 * account URL itself, which is where a browser leaves it after the gate's 302.
 */
export function accountUrl(accountBase: string, returnTo: string): string {
  const hashAt = returnTo.indexOf('#')
  const url = new URL(accountBase)
  url.hash = ''
  url.searchParams.set('returnTo', hashAt === -1 ? returnTo : returnTo.slice(0, hashAt))
  return hashAt === -1 ? url.href : url.href + returnTo.slice(hashAt)
}

/**
 * `accountUrl` with the base taken from where the app is running: production hub
 * for a production app, hub's dev or compose port for an app on the matching
 * localhost tier. Null outside the estate (such as espy's Capacitor shell), and
 * null whenever `safeReturnTo` would refuse the resulting `returnTo`.
 */
export function accountUrlFor(currentHref: string): string | null {
  let origin: string
  try {
    origin = new URL(currentHref).origin
  } catch {
    return null
  }
  const tier = accountTierFor(origin)
  if (tier === null) return null
  const returnTo = safeReturnTo(currentHref, { allowLocal: tier.local })
  if (returnTo === null) return null
  const hashAt = currentHref.indexOf('#')
  return accountUrl(tier.base, hashAt === -1 ? returnTo : returnTo + currentHref.slice(hashAt))
}

function accountTierFor(origin: string): { base: string; local: boolean } | null {
  for (const app of ESTATE_APPS) {
    if (origin === `https://${app.host}`)
      return { base: 'https://homeofed.com/account', local: false }
    if (origin === `http://localhost:${app.devPort}`)
      return { base: `http://localhost:${HUB_LOCAL_PORTS.devPort}/account`, local: true }
    if (origin === `http://localhost:${app.composePort}`)
      return { base: `http://localhost:${HUB_LOCAL_PORTS.composePort}/account`, local: true }
  }
  return null
}

/** An app's ungated share view, or null when `safeReturnTo` refuses `returnTo`. */
export function sharedUrl(
  returnTo: string,
  fragment: string,
  opts: SafeReturnToOpts,
): string | null {
  const safe = safeReturnTo(returnTo, opts)
  if (safe === null) return null
  const hash = fragment === '' || fragment.startsWith('#') ? fragment : `#${fragment}`
  return `${new URL(safe).origin}/shared${hash}`
}

/**
 * The URL hub may send a visitor back to, normalised and without its fragment,
 * or null. Exact origin match against `ESTATE_APPS`; anything the URL parser
 * would quietly repair (whitespace, backslashes, userinfo, odd slashes or case)
 * is refused rather than repaired.
 */
export function safeReturnTo(
  raw: string | null | undefined,
  opts: SafeReturnToOpts,
): string | null {
  if (typeof raw !== 'string' || !/^[\x21-\x7e]+$/.test(raw) || raw.includes('\\')) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.username !== '' || url.password !== '') return null
  if (!allowedOrigins(opts.allowLocal).has(url.origin)) return null
  if (!startsWithOrigin(raw, url.origin)) return null
  url.hash = ''
  return url.href
}

function startsWithOrigin(raw: string, origin: string): boolean {
  if (!raw.startsWith(origin)) return false
  const next = raw.charAt(origin.length)
  return next === '' || next === '/' || next === '?' || next === '#'
}

function allowedOrigins(allowLocal: boolean): Set<string> {
  const origins = new Set(ESTATE_APPS.map((app) => `https://${app.host}`))
  if (allowLocal) {
    for (const app of ESTATE_APPS) {
      origins.add(`http://localhost:${app.devPort}`)
      origins.add(`http://localhost:${app.composePort}`)
    }
  }
  return origins
}
