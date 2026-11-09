// CORS is the only barrier in front of a service every SPA calls
// browser-direct and cross-origin (spec §4.5), and the identity router is
// authorised by a cookie that any same-site origin would send. The allowlist is
// config: never `*`, never an unchecked reflect, and deliberately narrow
// ([ADR 0078](../../../../docs/adr/0078-family-identity-auth-boundary.md)).
import type { FastifyInstance } from '@hoe/backend-kit/server'

import { onboardedAppDevOrigins, onboardedAppOrigins } from './onboardedApps.ts'

/**
 * The hub account UI alone, because the Better Auth cookie session is only ever
 * used from there (spec §4.2). An app origin here could erase a household from
 * an XSS, which is why the save router has its own list below.
 */
export const IDENTITY_ALLOWED_ORIGINS = ['https://homeofed.com'] as const

/** Dev servers: hub 3000 and family's own 3010. */
export const DEV_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:3010'] as const

export function identityAllowedOrigins(nodeEnv: string | undefined): readonly string[] {
  return nodeEnv === 'production'
    ? IDENTITY_ALLOWED_ORIGINS
    : [...IDENTITY_ALLOWED_ORIGINS, ...DEV_ALLOWED_ORIGINS]
}

/**
 * The save router is authorised by the family session token rather than a
 * cookie, and apps call it browser-direct, so onboarded app origins belong here
 * - a superset of the identity tier, never the other way round.
 */
export function saveAllowedOrigins(nodeEnv: string | undefined): readonly string[] {
  return [
    ...identityAllowedOrigins(nodeEnv),
    ...onboardedAppOrigins(),
    ...(nodeEnv === 'production' ? [] : onboardedAppDevOrigins()),
  ]
}

export interface CorsTiers {
  /** Identity, `/api/auth/*` and everything else this service serves. */
  identity: readonly string[]
  /** The save router alone. */
  save: readonly string[]
}

const TRPC_PREFIX = '/api/trpc/'

/** tRPC procedure names are dotted identifiers, so anything encoded fails this. */
const SAVE_PROCEDURE = /^save\.[A-Za-z0-9_]+$/

/**
 * tRPC batches several procedures into one path, so the save tier applies only
 * when every procedure in the request is a save procedure: otherwise an app
 * origin could hide `identity.deleteAccount` behind one and read the reply.
 */
function isSaveOnlyRequest(url: string): boolean {
  const path = url.split('?')[0] ?? ''
  if (!path.startsWith(TRPC_PREFIX)) return false
  return path
    .slice(TRPC_PREFIX.length)
    .split(',')
    .every((procedure) => SAVE_PROCEDURE.test(procedure))
}

const ALLOWED_METHODS = 'GET, POST, OPTIONS'
const ALLOWED_HEADERS = 'content-type'
const PREFLIGHT_MAX_AGE = '600'

export function registerCors(app: FastifyInstance, tiers: CorsTiers): void {
  const identity = new Set(tiers.identity)
  const save = new Set(tiers.save)

  app.addHook('onRequest', async (req, reply) => {
    // Set whatever the outcome; tRPC's adapter overwrites it on its own
    // responses, which is why no cache rule may ever cover /api/trpc.
    reply.header('vary', 'Origin')
    const origin = req.headers.origin
    const allowed = isSaveOnlyRequest(req.url) ? save : identity
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
