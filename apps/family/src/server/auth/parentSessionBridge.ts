// Bridges Better Auth's async session onto the synchronous AppContext auth seam
// with a server-stamped header (ADR 0078, after sprout's ADR 0012). Node-only.
import type { AuthProvider } from '@hoe/backend-kit'
import type { FastifyInstance } from '@hoe/backend-kit/server'

import { toFetchHeaders } from '../fastifyBridge.ts'

import { parentSessionProvider, resolveParentId, type SessionResolver } from './parentSession.ts'

const PARENT_HEADER = 'x-family-parent'

const anonymous: AuthProvider = { getUser: () => null }

/** The strip is the anti-spoof boundary: no inbound value ever survives it. */
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
