// Decode-only: no signature check, so the result is safe for display and
// never for an authorisation decision.
import type { FamilyTokenClaims } from './claims.ts'
import {
  decodeTokenPayload,
  isExpired,
  readFamilyTokenFromCookieHeader,
  validateClaimsShape,
} from './claims.ts'

export interface ReadFamilySessionOpts {
  cookie?: string
  now?: () => Date
}

export function readFamilySession(opts: ReadFamilySessionOpts = {}): FamilyTokenClaims | null {
  const cookie = opts.cookie ?? defaultCookieSource()
  if (cookie === null) return null
  const token = readFamilyTokenFromCookieHeader(cookie)
  if (token === null) return null
  const claims = validateClaimsShape(decodeTokenPayload(token))
  if (claims === null) return null
  if (isExpired(claims, opts.now ?? (() => new Date()))) return null
  return claims
}

// Reached structurally because the package targets no DOM lib and also runs under node.
function defaultCookieSource(): string | null {
  const doc = (globalThis as { document?: { cookie?: unknown } }).document
  return typeof doc?.cookie === 'string' ? doc.cookie : null
}
