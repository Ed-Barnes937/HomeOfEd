import type { SafeReturnToOpts } from '@hoe/accounts'

/**
 * Where the family service lives, and how the cookie it mints may be stored.
 * Local hostnames talk to the local service (`pnpm dev --filter=family`, port
 * 3012); everything else talks to production. Same shape and the same reason as
 * boop's `familyUrl.ts`: hub is served from several hostnames and must never
 * point a browser at a dev box.
 */
export function familyUrl(hostname: string): string {
  return isLocal(hostname) ? 'http://localhost:3012' : 'https://family.homeofed.com'
}

/**
 * The spec fixes `Domain=.homeofed.com` and `Secure` (§4.4) because the cookie
 * has to reach every app's subdomain. Neither can be set from a local hostname,
 * so dev and the .iwft harness get a host-scoped, plain cookie instead - which
 * is all they need, since nothing else is served from there.
 */
export function familySessionCookieOptions(hostname: string): {
  domain?: string
  secure?: boolean
} {
  return isLocal(hostname) ? {} : { domain: '.homeofed.com', secure: true }
}

/**
 * Localhost app origins are only a safe `returnTo` while hub itself is on
 * localhost, decided from the hostname exactly as the cookie's `Domain` is.
 */
export function returnToOptions(hostname: string): SafeReturnToOpts {
  return { allowLocal: isLocal(hostname) }
}

function isLocal(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}
