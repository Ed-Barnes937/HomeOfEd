/** compose.yml's host ports: boop's own, and the family service it saves to. */
const DOCKER_STACK_PORTS = { boop: '8088', family: 8092 } as const

/**
 * Where the family service lives. Local hostnames talk to the local service:
 * the docker stack's from boop's compose port, otherwise `pnpm dev
 * --filter=family` on 3012. Everything else talks to the one in production.
 * Same shape as `hubUrl.ts`, and the same reason: boop is served from several
 * hostnames and must never point a child's browser at a dev box.
 */
export function familyUrl(hostname: string, port: string): string {
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') return 'https://family.homeofed.com'
  return port === DOCKER_STACK_PORTS.boop
    ? `http://localhost:${DOCKER_STACK_PORTS.family}`
    : 'http://localhost:3012'
}
