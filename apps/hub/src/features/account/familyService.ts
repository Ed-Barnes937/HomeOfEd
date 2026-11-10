import { HUB_LOCAL_PORTS } from '@hoe/accounts'

/** compose.yml's host port for the family service; hub's own is in the estate registry. */
const DOCKER_STACK_FAMILY_PORT = 8092

/**
 * Where the family service lives, and how the cookie it mints may be stored.
 * Local hostnames talk to the local service: the docker stack's from hub's
 * compose port, otherwise `pnpm dev --filter=family` on 3012. Everything else
 * talks to production. Same shape and the same reason as boop's `familyUrl.ts`:
 * hub is served from several hostnames and must never point a browser at a dev box.
 */
export function familyUrl(hostname: string, port: string): string {
  if (!isLocal(hostname)) return 'https://family.homeofed.com'
  return port === String(HUB_LOCAL_PORTS.composePort)
    ? `http://localhost:${DOCKER_STACK_FAMILY_PORT}`
    : 'http://localhost:3012'
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

function isLocal(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}
