import { ESTATE_APPS } from '@hoe/accounts'

/** compose.yml's host port for the family service; boop's own is in the estate registry. */
const DOCKER_STACK_FAMILY_PORT = 8092
const BOOP_COMPOSE_PORT = String(ESTATE_APPS.find((app) => app.appId === 'boop')?.composePort)

/**
 * Where the family service lives. Local hostnames talk to the local service:
 * the docker stack's from boop's compose port, otherwise `pnpm dev
 * --filter=family` on 3012. Everything else talks to the one in production.
 * Same idea as `hubUrlFor`, and the same reason: boop is served from several
 * hostnames and must never point a child's browser at a dev box.
 */
export function familyUrl(hostname: string, port: string): string {
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') return 'https://family.homeofed.com'
  return port === BOOP_COMPOSE_PORT
    ? `http://localhost:${DOCKER_STACK_FAMILY_PORT}`
    : 'http://localhost:3012'
}
