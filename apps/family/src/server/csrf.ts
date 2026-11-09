// The CORS allowlist governs what a browser may READ, never what it may SEND.
// A CORS-simple request carries no preflight at all, so the allowlist is never
// consulted and the mutation has already committed by the time the browser
// discards the reply it may not read. Requiring a content type that is not
// CORS-safelisted forces the preflight back into existence, and the allowlist
// then governs it ([ADR 0078](../../../../docs/adr/0078-family-identity-auth-boundary.md)).
import type { FastifyInstance } from '@hoe/backend-kit/server'

const TRPC_PREFIX = '/api/trpc'

/** Nothing here mutates, and tRPC maps a mutation to POST either way. */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const REQUIRED_CONTENT_TYPE = 'application/json'

/**
 * The other limit on what one inbound request may ask for: tRPC leaves a
 * batch's fan-out unlimited, and every procedure here is database-backed.
 */
export const MAX_BATCH_SIZE = 10

export function registerTrpcCsrfGuard(app: FastifyInstance): void {
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith(TRPC_PREFIX)) return
    if (READ_METHODS.has(req.method)) return

    // Lower-cased because RFC 7231 makes a media type case-insensitive.
    const contentType = req.headers['content-type']?.toLowerCase()
    if (contentType !== undefined && contentType.startsWith(REQUIRED_CONTENT_TYPE)) return

    return reply.status(415).send({
      error: {
        message: `tRPC requests must be sent with content-type: ${REQUIRED_CONTENT_TYPE}`,
        data: { code: 'UNSUPPORTED_MEDIA_TYPE', httpStatus: 415 },
      },
    })
  })
}
