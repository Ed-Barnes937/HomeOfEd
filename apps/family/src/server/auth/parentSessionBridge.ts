// Better Auth resolves a session asynchronously; the AppContext auth seam is
// synchronous. The bridge is a server-stamped request header, written only from
// a verified session - the sprout precedent (ADR 0012). Node-only (Fastify).
import type { AuthProvider } from '@hoe/backend-kit'
import type { FastifyInstance } from '@hoe/backend-kit/server'

import { toFetchHeaders } from '../fastifyBridge.ts'

import { parentSessionProvider, resolveParentId, type SessionResolver } from './parentSession.ts'

const PARENT_HEADER = 'x-family-parent'

const anonymous: AuthProvider = { getUser: () => null }

/**
 * Strips any inbound `x-family-parent` so a client can never supply one, then
 * re-stamps it from the Better Auth cookie session for tRPC requests only.
 */
export function registerParentSessionBridge(app: FastifyInstance, auth: SessionResolver): void {
  app.addHook('onRequest', async (req) => {
    delete req.headers[PARENT_HEADER]
    if (!req.url.startsWith('/api/trpc')) return
    const parentId = await resolveParentId(auth, toFetchHeaders(req))
    if (parentId !== null) req.headers[PARENT_HEADER] = parentId
  })
}

/** The `auth` dep of createContext: trusts the stamped header and nothing else. */
export function parentSessionSeam(req: Request): AuthProvider {
  const parentId = req.headers.get(PARENT_HEADER)
  return parentId === null ? anonymous : parentSessionProvider(parentId)
}
