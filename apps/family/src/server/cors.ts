// CORS is the only barrier in front of a service every SPA calls
// browser-direct and cross-origin (spec §4.5), and the identity router is
// authorised by a cookie that any same-site origin would send. The allowlist is
// config: never `*`, never an unchecked reflect, and deliberately narrow
// ([ADR 0078](../../../../docs/adr/0078-family-identity-auth-boundary.md)).
import type { FastifyInstance } from '@hoe/backend-kit/server'

/**
 * The hub account UI alone, because the Better Auth cookie session is only ever
 * used from there (spec §4.2). An app origin here could erase a household from
 * an XSS, so onboarded apps get the save router's own list in ticket 05.
 */
export const IDENTITY_ALLOWED_ORIGINS = ['https://homeofed.com'] as const

/** Dev servers: hub 3000 and family's own 3010. */
export const DEV_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:3010'] as const

export function identityAllowedOrigins(nodeEnv: string | undefined): readonly string[] {
  return nodeEnv === 'production'
    ? IDENTITY_ALLOWED_ORIGINS
    : [...IDENTITY_ALLOWED_ORIGINS, ...DEV_ALLOWED_ORIGINS]
}

const ALLOWED_METHODS = 'GET, POST, OPTIONS'
const ALLOWED_HEADERS = 'content-type'
const PREFLIGHT_MAX_AGE = '600'

export function registerCors(app: FastifyInstance, origins: readonly string[]): void {
  const allowed = new Set(origins)

  app.addHook('onRequest', async (req, reply) => {
    // Set whatever the outcome; tRPC's adapter overwrites it on its own
    // responses, which is why no cache rule may ever cover /api/trpc.
    reply.header('vary', 'Origin')
    const origin = req.headers.origin
    if (typeof origin === 'string' && allowed.has(origin)) {
      reply.header('access-control-allow-origin', origin)
      reply.header('access-control-allow-credentials', 'true')
      reply.header('access-control-allow-headers', ALLOWED_HEADERS)
      reply.header('access-control-allow-methods', ALLOWED_METHODS)
      reply.header('access-control-max-age', PREFLIGHT_MAX_AGE)
    }
    // A disallowed origin still gets the 204, but without the allow headers,
    // which the browser reads as a refusal.
    if (req.method === 'OPTIONS') return reply.status(204).send()
  })
}
