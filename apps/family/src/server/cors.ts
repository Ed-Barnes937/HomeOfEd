// Every app's SPA talks to this service browser-direct and cross-origin, so
// CORS is the only barrier in front of it (spec §4.5). The allowlist is config:
// never `*`, and never the request's own origin reflected back unchecked.
import type { FastifyInstance } from '@hoe/backend-kit/server'

/** Onboarded apps. Letting a new app reach the save router starts here. */
export const PROD_ALLOWED_ORIGINS = ['https://homeofed.com', 'https://boop.homeofed.com'] as const

/** Dev servers: hub 3000, boop 3008, family's own 3010. */
export const DEV_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3008',
  'http://localhost:3010',
] as const

export function allowedOrigins(nodeEnv: string | undefined): readonly string[] {
  return nodeEnv === 'production'
    ? PROD_ALLOWED_ORIGINS
    : [...PROD_ALLOWED_ORIGINS, ...DEV_ALLOWED_ORIGINS]
}

const ALLOWED_METHODS = 'GET, POST, OPTIONS'
const ALLOWED_HEADERS = 'content-type'
const PREFLIGHT_MAX_AGE = '600'

export function registerCors(app: FastifyInstance, origins: readonly string[]): void {
  const allowed = new Set(origins)

  app.addHook('onRequest', async (req, reply) => {
    // Set whatever the outcome, so no cache reuses a response across origins.
    // tRPC's adapter writes its own Vary straight to the raw response, so this
    // survives on the preflight and the Better Auth routes, not on tRPC's.
    reply.header('vary', 'Origin')
    const origin = req.headers.origin
    if (typeof origin === 'string' && allowed.has(origin)) {
      reply.header('access-control-allow-origin', origin)
      reply.header('access-control-allow-credentials', 'true')
      reply.header('access-control-allow-headers', ALLOWED_HEADERS)
      reply.header('access-control-allow-methods', ALLOWED_METHODS)
      reply.header('access-control-max-age', PREFLIGHT_MAX_AGE)
    }
    // Preflight stops here. A disallowed origin still gets the 204, but without
    // the allow headers, which the browser reads as a refusal.
    if (req.method === 'OPTIONS') return reply.status(204).send()
  })
}
