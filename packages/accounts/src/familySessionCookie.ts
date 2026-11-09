// The write half of `readFamilySession`. The family token is deliberately NOT
// httpOnly (ADR 0070, spec §4.4): hub sets it here, client-side, from the mint
// reply, and every server use re-verifies the signature, so a tampered cookie
// can only forge pixels.
import type { FamilyTokenClaims } from './claims.ts'
import {
  decodeTokenPayload,
  FAMILY_SESSION_COOKIE,
  isExpired,
  validateClaimsShape,
} from './claims.ts'

/** Just enough of `document` to set a cookie; the default is `document` itself. */
export interface CookieJar {
  cookie: string
}

export interface FamilySessionCookieOptions {
  /** `.homeofed.com` in production. Omitted where a browser would refuse it. */
  domain?: string
  secure?: boolean
  jar?: CookieJar
  now?: () => Date
}

/**
 * The cookie string for a freshly minted token, or null when the token cannot be
 * decoded or has already expired - a cookie nothing can read back is worse than
 * no cookie, because the UI would report a session that does not exist.
 */
export function familySessionCookieString(
  token: string,
  opts: FamilySessionCookieOptions = {},
): string | null {
  const claims = decodeClaims(token, opts.now ?? (() => new Date()))
  if (claims === null) return null
  const maxAge = Math.floor((claims.exp - (opts.now ?? (() => new Date()))().getTime()) / 1000)
  return [
    `${FAMILY_SESSION_COOKIE}=${token}`,
    'Path=/',
    ...(opts.domain === undefined ? [] : [`Domain=${opts.domain}`]),
    `Max-Age=${maxAge}`,
    ...(opts.secure === true ? ['Secure'] : []),
    'SameSite=Lax',
  ].join('; ')
}

/** Sets the cookie and returns the claims it carries, or null if it refused. */
export function writeFamilySession(
  token: string,
  opts: FamilySessionCookieOptions = {},
): FamilyTokenClaims | null {
  const cookie = familySessionCookieString(token, opts)
  if (cookie === null) return null
  const jar = opts.jar ?? defaultJar()
  if (jar === null) return null
  jar.cookie = cookie
  return decodeClaims(token, opts.now ?? (() => new Date()))
}

/** Signing out, switching profiles away, and erasing the account all land here. */
export function clearFamilySession(opts: FamilySessionCookieOptions = {}): void {
  const jar = opts.jar ?? defaultJar()
  if (jar === null) return
  jar.cookie = [
    `${FAMILY_SESSION_COOKIE}=`,
    'Path=/',
    ...(opts.domain === undefined ? [] : [`Domain=${opts.domain}`]),
    'Max-Age=0',
    ...(opts.secure === true ? ['Secure'] : []),
    'SameSite=Lax',
  ].join('; ')
}

function decodeClaims(token: string, now: () => Date): FamilyTokenClaims | null {
  if (token === '') return null
  const claims = validateClaimsShape(decodeTokenPayload(token))
  if (claims === null || isExpired(claims, now)) return null
  return claims
}

// Reached structurally because the package targets no DOM lib and also runs under node.
function defaultJar(): CookieJar | null {
  const doc = (globalThis as { document?: { cookie?: unknown } }).document
  return typeof doc?.cookie === 'string' ? (doc as CookieJar) : null
}
